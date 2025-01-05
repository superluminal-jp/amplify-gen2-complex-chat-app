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
    RAG retrieval & generation Lambda

    Expects event like:
    {
      "arguments": {
        "s3_bucket": "my-bucket",
        "s3_index_key": "embeddings/my_index.faiss",
        "metadata_key": "embeddings/metadata.json",
        "query": "What is the capital of Japan?",
        "top_k": 5,
        "prompt_template": ""
      }
    }

    Steps:
      1) Parse arguments
      2) Load Faiss index from S3
      3) Embed the user query via Bedrock
      4) Search top_k docs
      5) Load metadata -> map vector IDs to file keys (embedded_files_sequence)
      6) Fetch each doc from S3
      7) Generate a final answer using a text-generation model (Bedrock)
      8) Return the generated answer
    """
    logger.info(f"Received event: {json.dumps(event)}")

    # 1) Parse arguments
    try:
        s3_bucket = event["arguments"]["s3_bucket"]
        s3_index_key = event["arguments"]["s3_index_key"]
        metadata_key = event["arguments"]["metadata_key"]
        query_text = event["arguments"]["query"]
        top_k = event["arguments"].get("top_k", 3)
        prompt_template = event["arguments"].get("prompt_template", "")
    except KeyError as e:
        error_msg = f"Missing required parameter: {str(e)}"
        logger.error(error_msg)
        return {"statusCode": 400, "body": json.dumps({"error": error_msg})}

    logger.info(
        f"Parsed: s3_bucket={s3_bucket}, s3_index_key={s3_index_key}, "
        f"metadata_key={metadata_key}, query='{query_text}', top_k={top_k}"
    )

    s3_client = boto3.client("s3", region_name="ap-northeast-1")

    # 2) Load Faiss index from S3
    index_path = "/tmp/faiss.index"
    try:
        s3_client.download_file(s3_bucket, s3_index_key, index_path)
        index = faiss.read_index(index_path)
        logger.info(f"Loaded Faiss index from {s3_index_key}")
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            err = f"Faiss index not found at s3://{s3_bucket}/{s3_index_key}"
            logger.error(err)
            return {"statusCode": 404, "body": json.dumps({"error": err})}
        else:
            err = f"Error downloading Faiss index: {str(e)}"
            logger.error(err)
            return {"statusCode": 500, "body": json.dumps({"error": err})}
    except Exception as e:
        err = f"Error reading Faiss index: {str(e)}"
        logger.error(err)
        return {"statusCode": 500, "body": json.dumps({"error": err})}

    # 3) Embed the query via Bedrock
    try:
        bedrock_client = boto3.client("bedrock-runtime", region_name="ap-northeast-1")
        embed_model_id = "amazon.titan-embed-text-v2:0"  # embedding model
        request_json = json.dumps({"inputText": query_text})
        response = bedrock_client.invoke_model(modelId=embed_model_id, body=request_json)
        model_response = json.loads(response["body"].read())

        query_embedding = model_response["embedding"]
        query_embedding_np = np.array([query_embedding], dtype=np.float32)
    except Exception as e:
        err = f"Error embedding query: {str(e)}"
        logger.error(err)
        return {"statusCode": 500, "body": json.dumps({"error": err})}

    # 4) Faiss search for top_k nearest
    try:
        distances, indices = index.search(query_embedding_np, top_k)
        logger.info(f"Faiss search done. Indices={indices}, Distances={distances}")
    except Exception as e:
        err = f"Error searching index: {str(e)}"
        logger.error(err)
        return {"statusCode": 500, "body": json.dumps({"error": err})}

    # 5) Load metadata to map from vector IDs → file keys
    metadata = _load_metadata(s3_client, s3_bucket, metadata_key)

    embedded_files_sequence = metadata.get("embedded_files_sequence", [])
    if not embedded_files_sequence:
        err = "No 'embedded_files_sequence' found in metadata. Cannot map FAISS indices to original docs."
        logger.error(err)
        return {"statusCode": 500, "body": json.dumps({"error": err})}

    # Retrieve doc keys
    retrieved_doc_keys = []
    for idx in indices[0]:
        if 0 <= idx < len(embedded_files_sequence):
            doc_key = embedded_files_sequence[idx]
            retrieved_doc_keys.append(doc_key)
        else:
            logger.warning(
                f"Index {idx} out of range for embedded_files_sequence (len={len(embedded_files_sequence)})"
            )

    # 6) Fetch each doc from S3
    #    (In a real scenario, handle large docs & chunking, or store summaries, etc.)
    doc_texts = []
    for key in retrieved_doc_keys:
        try:
            file_resp = s3_client.get_object(Bucket=s3_bucket, Key=key)
            text_data = file_resp["Body"].read().decode("utf-8")
            doc_texts.append((key, text_data))
        except Exception as e:
            logger.error(f"Error fetching {key}: {str(e)}")

    # 7) Generate final answer using text-generation model
    if not prompt_template:
        prompt_template = (
            "You are a knowledgeable assistant. You have access to the following documents:\n\n"
            "{retrieved_docs}\n\n"
            "User question: {user_query}\n"
            "Please provide a helpful and concise answer based on the documents."
        )

    retrieved_docs_str = ""
    for i, (doc_key, doc_text) in enumerate(doc_texts):
        retrieved_docs_str += f"[Doc{i}] Key: {doc_key}\n{doc_text}\n\n"

    final_prompt = prompt_template.format(
        user_query=query_text,
        retrieved_docs=retrieved_docs_str
    )

    # Build Messages API-compatible structure
    messages = [
        {
            "role": "user",
            "content": [
                {"text": final_prompt},
            ],
        }
    ]

    # Generate answer
    generated_text = ""
    try:
        gen_model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"
        gen_client = boto3.client("bedrock-runtime", region_name="ap-northeast-1")

        model_response = gen_client.converse(
            modelId=gen_model_id,
            messages=messages,
        )
        generated_text = model_response["output"]["message"]["content"][0]["text"]

        logger.info(f"Generated answer: {generated_text}")

    except Exception as e:
        logger.error(f"Error during text generation: {str(e)}")
        generated_text = "Error generating text."

    # 8) Return the generated answer
    return {
        "statusCode": 200,
        "body": json.dumps({
            "query": query_text,
            "retrieved_doc_keys": retrieved_doc_keys,
            "answer": generated_text
        }, ensure_ascii=False),
    }


def _load_metadata(s3_client, s3_bucket: str, metadata_key: str) -> dict:
    """
    Helper to load metadata from S3
    """
    try:
        resp = s3_client.get_object(Bucket=s3_bucket, Key=metadata_key)
        data = resp["Body"].read().decode("utf-8")
        loaded = json.loads(data)
        logger.info(f"Loaded metadata from s3://{s3_bucket}/{metadata_key}")
        return loaded
    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"Metadata not found at s3://{s3_bucket}/{metadata_key}, returning empty.")
        return {}
    except Exception as e:
        logger.error(f"Error loading metadata; returning empty. Details: {str(e)}")
        return {}