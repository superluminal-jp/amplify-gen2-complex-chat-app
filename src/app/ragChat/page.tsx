"use client";

import { useEffect, useState } from "react";
import {
    Flex,
    Heading,
    Text,
    Button,
    TextAreaField,
} from "@aws-amplify/ui-react";
import {
    createAmplifyAuthAdapter,
    createStorageBrowser,
} from "@aws-amplify/ui-react-storage/browser";

import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";

import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

export const { StorageBrowser } = createStorageBrowser({
    config: createAmplifyAuthAdapter(),
});

export default function RagChat() {
    const [query, setQuery] = useState("");
    const [answer, setAnswer] = useState("");
    const [retrivedDocKeys, setRetrivedDocKeys] = useState<string[]>([]);

    const s3_bucket = outputs.storage.bucket_name;
    const s3_region = outputs.storage.aws_region;
    const s3_folder_prefix = "public";
    const s3_index_key = `embeddings/${s3_folder_prefix}.faiss`;
    const bedrock_region = s3_region;
    const metadata_key = `embeddings/${s3_folder_prefix}_metadata.json`;

    const [responseEmbedding, setResponseEmbedding] = useState("");

    const handleEmbeddingButtonClick = async () => {
        try {
            console.log("update Embeddings");
            console.log(
                s3_bucket,
                s3_folder_prefix,
                s3_index_key,
                bedrock_region,
                metadata_key
            );
            const response = await client.queries.embedding({
                s3_bucket: s3_bucket,
                s3_folder_prefix: s3_folder_prefix,
                s3_index_key: s3_index_key,
                bedrock_region: bedrock_region,
                metadata_key: metadata_key,
            });
            console.log(response);
            const responseData = JSON.parse(response.data as string);
            setResponseEmbedding(responseData);
            console.log(responseEmbedding);
        } catch (error) {
            console.error(error);
        }
    };

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            console.log("Submit Query:", query);

            const response = await client.queries.ragChat({
                s3_bucket: s3_bucket,
                s3_index_key: s3_index_key,
                metadata_key: metadata_key,
                query: query,
                top_k: 5,
            });

            console.log("Response from RAG Chat:", response);

            // Step 1: Parse the top-level response.data
            if (response && response.data) {
                const parsedData = JSON.parse(response.data as string);

                // Step 2: Parse the nested body field
                if (parsedData.body) {
                    const responseData = JSON.parse(parsedData.body);

                    // Step 3: Validate and extract the data
                    if (
                        responseData.query &&
                        responseData.retrieved_doc_keys &&
                        responseData.answer
                    ) {
                        setAnswer(responseData.answer || "");
                        setRetrivedDocKeys(
                            responseData.retrieved_doc_keys || []
                        );
                        console.log("Response body:", responseData);
                        console.log("Query:", responseData.query);
                        console.log(
                            "Retrieved doc keys:",
                            responseData.retrieved_doc_keys
                        );
                        console.log("Answer:", responseData.answer);
                    } else {
                        console.error(
                            "Unexpected response format:",
                            responseData
                        );
                    }
                } else {
                    console.error(
                        "Response body is missing or invalid:",
                        parsedData
                    );
                }
            } else {
                console.error("Response data is missing or invalid:", response);
            }
        } catch (error) {
            console.error("Error in RAG Chat:", error);
        }
    };

    return (
        <Flex>
            <div className="w-full max-w-4xl">
                <Flex direction="column" gap="1rem">
                    <Flex justifyContent="space-between" alignItems="center">
                        <Heading level={1}>RAG Chat App</Heading>
                    </Flex>

                    <StorageBrowser />

                    <Flex>
                        <Button onClick={handleEmbeddingButtonClick}>
                            Update Embeddings
                        </Button>
                    </Flex>

                    {responseEmbedding && (
                        <Text>
                            {JSON.stringify(responseEmbedding, null, 2)}
                        </Text>
                    )}

                    <Flex
                        as="form"
                        direction="column"
                        onSubmit={handleQuerySubmit}
                    >
                        <TextAreaField
                            autoResize
                            isRequired
                            label="Ask a query"
                            placeholder="Query"
                            resize="vertical"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                            }}
                        />
                        <Button type="submit">Submit</Button>
                    </Flex>

                    {answer && (
                        <Flex direction="column" marginTop="1rem">
                            <Heading level={3}>Response Information</Heading>
                            <Flex direction="column" gap="0.5rem">
                                <Flex direction="column">
                                    <Heading level={4}>Query</Heading>
                                    <Text>{query}</Text>
                                </Flex>
                                <Flex direction="column">
                                    <Heading level={4}>
                                        Retrieved Document Keys
                                    </Heading>
                                    {retrivedDocKeys.length > 0 ? (
                                        <ul>
                                            {retrivedDocKeys.map(
                                                (key, index) => (
                                                    <li key={index}>
                                                        <Text>{key}</Text>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    ) : (
                                        <Text>No documents retrieved.</Text>
                                    )}
                                </Flex>
                                <Flex direction="column">
                                    <Heading level={4}>Answer</Heading>
                                    <Text>{answer}</Text>
                                </Flex>
                            </Flex>
                        </Flex>
                    )}
                </Flex>
            </div>
        </Flex>
    );
}
