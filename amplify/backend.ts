import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { EmbeddingLambdaStack } from "./custom-functions/embedding/resource";
import { RagChatLambdaStack } from "./custom-functions/ragChat/resource";

const backend = defineBackend({
    auth,
    data,
    storage,
});

new EmbeddingLambdaStack(
    backend.createStack("EmbeddingLambdaStack"),
    "EmbeddingLambdaStack",
    {}
);

new RagChatLambdaStack(
    backend.createStack("RagChatLambdaStack"),
    "RagChatLambdaStack",
    {}
);
