import json
import logging
import os
from typing import Dict, Any, List

import boto3
import botocore

import faiss
import numpy as np

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    AWS Lambda handler that:
      1. Reads text files from S3 under a given folder (prefix).
      2. Checks metadata to see if the file has already been embedded; if so, skip.
      3. Calls Amazon Bedrock to get embeddings for new files only.
      4. Loads (or creates) a Faiss index, adds new embeddings to it, and stores it.
      5. Updates and stores metadata to S3 (including appended 'embedded_files_sequence').
      6. Removes from metadata any files that no longer exist in S3.

    Event structure:
      {
          "s3_bucket": "<S3 Bucket Name>",
          "s3_folder_prefix": "<Prefix/folder in S3 to read the original text files>",
          "s3_index_key": "<S3 object key for storing the Faiss index>",
          "bedrock_region": "<Region for Bedrock API, e.g. 'ap-northeast-1'>",
          "metadata_key": "<S3 object key for storing the metadata JSON>"
      }

    We assume the S3 bucket is in 'ap-northeast-1' as per user requirement.
    """
    logger.info(f"Received event: {json.dumps(event)}")

    # --- 1) Parse event inputs ---
    try:
        # You may receive event["arguments"]["s3_bucket"] if using AppSync style event;
        # adjust accordingly if your event is direct (event["s3_bucket"]).
        # Below code uses event.get('arguments', {}) for example:
        s3_bucket = event.get('arguments', {}).get("s3_bucket")
        s3_folder_prefix = event.get('arguments', {}).get("s3_folder_prefix")
        s3_index_key = event.get('arguments', {}).get("s3_index_key")
        bedrock_region = event.get('arguments', {}).get("bedrock_region", "ap-northeast-1")
        metadata_key = event.get('arguments', {}).get("metadata_key")

        logger.info(
            f"Parsed inputs: s3_bucket={s3_bucket}, "
            f"s3_folder_prefix={s3_folder_prefix}, s3_index_key={s3_index_key}, "
            f"bedrock_region={bedrock_region}, metadata_key={metadata_key}"
        )
    except KeyError as e:
        error_msg = f"Missing required event parameter: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 400, "body": json.dumps({"error": error_msg})}

    # Initialize S3 client
    s3_client = boto3.client("s3", region_name="ap-northeast-1")

    # --- 2) Load existing metadata (or create empty) ---
    metadata = _load_metadata(s3_client, s3_bucket, metadata_key)

    # If no embedded_files_sequence, create an empty list
    if "embedded_files_sequence" not in metadata:
        metadata["embedded_files_sequence"] = []

    # --- 3) List all objects under folder prefix ---
    logger.info(f"Listing S3 objects from s3://{s3_bucket}/{s3_folder_prefix}")
    try:
        objects_response = s3_client.list_objects_v2(
            Bucket=s3_bucket,
            Prefix=s3_folder_prefix
        )
    except Exception as e:
        error_msg = f"Error listing objects in S3: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    # 3a) If no objects exist, just return
    if "Contents" not in objects_response:
        msg = f"No files found under s3://{s3_bucket}/{s3_folder_prefix}"
        logger.warning(msg)
        return {"statusCode": 200, "body": json.dumps({"message": msg})}

    # 3b) Remove from metadata any files that no longer exist in S3
    existing_s3_keys = {
        obj["Key"] for obj in objects_response["Contents"] if not obj["Key"].endswith("/")
    }
    keys_to_remove = []
    for embedded_key in metadata["embedded_files"].keys():
        if embedded_key not in existing_s3_keys:
            keys_to_remove.append(embedded_key)
    if keys_to_remove:
        for k in keys_to_remove:
            del metadata["embedded_files"][k]
        logger.info(f"Removed {len(keys_to_remove)} metadata entries that no longer exist in S3: {keys_to_remove}")

    # Also remove them from embedded_files_sequence if present
    if keys_to_remove:
        new_sequence = [k for k in metadata["embedded_files_sequence"] if k not in keys_to_remove]
        metadata["embedded_files_sequence"] = new_sequence

    # --- 4) Embed new (unembedded) files ---
    new_embeddings_list = []
    new_metadata_entries = []

    # Initialize Bedrock client
    try:
        bedrock_client = boto3.client("bedrock-runtime", region_name=bedrock_region)
    except Exception as e:
        error_msg = f"Error initializing Bedrock client: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    for obj in objects_response["Contents"]:
        key = obj["Key"]
        # skip "folders"
        if key.endswith("/"):
            continue

        # skip if already embedded
        if key in metadata["embedded_files"]:
            logger.info(f"Skipping {key}, already embedded.")
            continue

        # read S3 file
        logger.info(f"Embedding new file: {key}")
        try:
            file_resp = s3_client.get_object(Bucket=s3_bucket, Key=key)
            text_data = file_resp["Body"].read().decode("utf-8")
        except Exception as e:
            logger.error(f"Error reading object {key}: {str(e)}")
            continue

        # 4a) Call Bedrock for embedding
        try:
            model_id = "amazon.titan-embed-text-v2:0"
            native_request = {"inputText": text_data}
            request_json = json.dumps(native_request)

            response = bedrock_client.invoke_model(modelId=model_id, body=request_json)
            model_response = json.loads(response["body"].read())

            embedding = model_response["embedding"]
            input_token_count = model_response.get("inputTextTokenCount", 0)

            # Collect the new embedding
            new_embeddings_list.append(embedding)

            # Prepare metadata for this file
            new_meta = {
                "input_token_count": input_token_count,
                "embedding_dim": len(embedding),
            }
            new_metadata_entries.append((key, new_meta))

        except Exception as e:
            logger.error(f"Error embedding text from {key} via Bedrock: {str(e)}")
            continue

    # If no new embeddings, we can exit early
    if not new_embeddings_list:
        msg = "No new embeddings were generated; everything is already embedded or no new files."
        logger.info(msg)
        return {"statusCode": 200, "body": json.dumps({"message": msg})}

    # --- 5) Load or create Faiss index, then add new vectors ---
    new_embedding_matrix = np.array(new_embeddings_list, dtype=np.float32)

    index_path = "/tmp/faiss.index"
    index = None
    loaded_existing_index = False

    try:
        s3_client.download_file(s3_bucket, s3_index_key, index_path)
        index = faiss.read_index(index_path)
        loaded_existing_index = True
        logger.info(f"Loaded existing Faiss index from {s3_index_key}")
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == '404':
            logger.warning(f"No existing Faiss index found at {s3_index_key}. Creating new one.")
            index = None
        else:
            error_msg = f"Error loading existing Faiss index: {str(e)}"
            logger.error(error_msg)
            return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    # create new index if needed
    if index is None:
        embedding_dim = new_embedding_matrix.shape[1]
        index = faiss.IndexFlatL2(embedding_dim)
        logger.info(f"Created a new Faiss index (dimension={embedding_dim}).")

    # check dimension consistency
    if loaded_existing_index:
        existing_dim = index.d
        new_dim = new_embedding_matrix.shape[1]
        if existing_dim != new_dim:
            error_msg = (
                f"Dimension mismatch! Existing index dim={existing_dim}, new embeddings={new_dim}."
            )
            logger.error(error_msg)
            return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    logger.info(f"Adding {len(new_embedding_matrix)} new vectors to Faiss index.")
    index.add(new_embedding_matrix)

    # --- 6) Upload updated Faiss index to S3 ---
    try:
        faiss.write_index(index, index_path)
        s3_client.upload_file(index_path, s3_bucket, s3_index_key)
        logger.info(f"Uploaded updated Faiss index to s3://{s3_bucket}/{s3_index_key}")
    except Exception as e:
        error_msg = f"Error uploading Faiss index to S3: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    # --- 7) Update metadata ---
    for (file_key, meta) in new_metadata_entries:
        metadata["embedded_files"][file_key] = meta
        # Also append the file key to 'embedded_files_sequence' in the order we embedded them
        metadata["embedded_files_sequence"].append(file_key)

    # Save updated metadata to S3
    try:
        _save_metadata(s3_client, s3_bucket, metadata_key, metadata)
    except Exception as e:
        error_msg = f"Error saving updated metadata to S3: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 500, "body": json.dumps({"error": error_msg})}

    success_msg = f"Successfully embedded {len(new_embeddings_list)} new files and updated Faiss index."
    logger.info(success_msg)
    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": success_msg,
                "index_key": s3_index_key,
                "metadata_key": metadata_key,
                "num_new_embeddings": len(new_embeddings_list),
            }
        ),
    }


def _load_metadata(s3_client, s3_bucket: str, metadata_key: str) -> dict:
    """
    Loads metadata JSON from s3://<bucket>/<metadata_key>.
    Returns a default structure if not found or invalid.
    """
    default_metadata = {
        "version": 1,
        "embedded_files": {},
        "embedded_files_sequence": []
    }
    try:
        resp = s3_client.get_object(Bucket=s3_bucket, Key=metadata_key)
        data = resp["Body"].read().decode("utf-8")
        loaded = json.loads(data)

        # Ensure required keys exist
        if "embedded_files" not in loaded:
            loaded["embedded_files"] = {}
        if "embedded_files_sequence" not in loaded:
            loaded["embedded_files_sequence"] = []
        if "version" not in loaded:
            loaded["version"] = 1

        logger.info(f"Loaded existing metadata from s3://{s3_bucket}/{metadata_key}")
        return loaded

    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"No existing metadata at s3://{s3_bucket}/{metadata_key}. Using defaults.")
        return default_metadata
    except Exception as e:
        logger.error(f"Error loading metadata; using defaults. Details: {str(e)}")
        return default_metadata


def _save_metadata(s3_client, s3_bucket: str, metadata_key: str, metadata: dict):
    """
    Saves `metadata` dict as JSON to s3://<bucket>/<metadata_key>.
    """
    metadata_json = json.dumps(metadata, indent=2)
    s3_client.put_object(
        Bucket=s3_bucket,
        Key=metadata_key,
        Body=metadata_json.encode("utf-8")
    )
    logger.info(f"Saved updated metadata to s3://{s3_bucket}/{metadata_key}")