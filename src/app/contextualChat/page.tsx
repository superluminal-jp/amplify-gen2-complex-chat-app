"use client";

import { useState } from "react";
import { Flex, Heading, View, TextAreaField } from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

export default function ContextChat() {
    const selectedModel = "chatClaude35Sonnet";

    const [context, setContext] = useState("");

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
                <Heading level={1}>Context Chat App</Heading>
            </Flex>

            <Flex>
                <TextAreaField
                    autoResize
                    label="Context"
                    placeholder="Additional knowledge"
                    resize="vertical"
                    value={context}
                    onChange={(e) => {
                        setContext(e.target.value);
                    }}
                    width="100%"
                />
            </Flex>

            <View>
                <AIConversation
                    messages={messages}
                    isLoading={isLoading}
                    handleSendMessage={handleSendMessage}
                    allowAttachments
                    aiContext={() => {
                        return {
                            context: context,
                        };
                    }}
                />
            </View>
        </Flex>
    );
}
