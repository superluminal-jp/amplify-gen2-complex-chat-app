import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
    chat: a
        .conversation({
            aiModel: a.ai.model("Claude 3.5 Sonnet"),
            systemPrompt: "You are a helpful assistant.",
        })
        .authorization((allow) => allow.owner()),

    chatClaude35Sonnet: a
        .conversation({
            aiModel: a.ai.model("Claude 3.5 Sonnet"),
            systemPrompt: "You are a helpful assistant.",
        })
        .authorization((allow) => allow.owner()),

    chatClaude3Haiku: a
        .conversation({
            aiModel: a.ai.model("Claude 3 Haiku"),
            systemPrompt: "You are a helpful assistant.",
        })
        .authorization((allow) => allow.owner()),

    embedding: a
        .query()
        .arguments({
            s3_bucket: a.string(),
            s3_folder_prefix: a.string(),
            s3_index_key: a.string(),
            bedrock_region: a.string(),
            metadata_key: a.string(),
        })
        .returns(a.json())
        .authorization((allow) => allow.publicApiKey())
        .handler(a.handler.function(`embeddingFunction`)),

    ragChat: a
        .query()
        .arguments({
            s3_bucket: a.string(),
            s3_index_key: a.string(),
            metadata_key: a.string(),
            query: a.string(),
            top_k: a.integer(),
            prompt_template: a.string(),
        })
        .returns(a.json())
        .authorization((allow) => allow.publicApiKey())
        .handler(a.handler.function(`ragChatFunction`)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: "apiKey", // "userPool",
        apiKeyAuthorizationMode: {
            expiresInDays: 30,
        },
    },
});
