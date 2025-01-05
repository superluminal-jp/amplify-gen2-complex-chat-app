"use client";

import { Flex, Heading, View } from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

export default function SimpleChat() {
    const selectedModel = "chatClaude3Haiku";

    const [
        {
            data: { messages },
            isLoading,
        },
        handleSendMessage,
    ] = useAIConversation(selectedModel);

    return (
        <Flex direction="column" gap="1rem" style={{ width: "100%" }}>
            <Flex>
                <Heading level={1}>Simple Chat App</Heading>
            </Flex>
            <View>
                <AIConversation
                    messages={messages}
                    isLoading={isLoading}
                    handleSendMessage={handleSendMessage}
                    allowAttachments
                />
            </View>
        </Flex>
    );
}
