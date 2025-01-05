"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
    Flex,
    Heading,
    SelectField,
    TextAreaField,
    View,
} from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

export default function ContextualChat() {
    const [context, setContext] = useState("");

    type ModelType = "chatClaude3Haiku" | "chatClaude35Sonnet";

    // Available AI models
    const models = [
        { value: "chatClaude3Haiku" as ModelType, label: "Claude 3 Haiku" },
        {
            value: "chatClaude35Sonnet" as ModelType,
            label: "Claude 3.5 Sonnet",
        },
    ];

    // State for the selected model
    const [selectedModel, setSelectedModel] =
        useState<ModelType>("chatClaude3Haiku");

    // Prepare conversations for all models
    const conversations = models.reduce((acc, model) => {
        const [conversationData, sendMessageHandler] = useAIConversation(
            model.value
        );
        acc[model.value] = { conversationData, sendMessageHandler };
        return acc;
    }, {} as Record<string, { conversationData: any; sendMessageHandler: any }>);

    // Extract selected model's conversation
    const { conversationData, sendMessageHandler } =
        conversations[selectedModel];

    return (
        <Flex direction="column" gap="1rem" style={{ width: "80%" }}>
            {/* Header */}
            <Flex>
                <Heading level={1}>Contextual Chat App</Heading>
            </Flex>

            {/* Context */}
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

            {/* Model Selection */}
            <Flex>
                <SelectField
                    label="Choose AI Model"
                    value={selectedModel}
                    onChange={(e) =>
                        setSelectedModel(e.target.value as ModelType)
                    }
                    width="100%"
                >
                    {models.map((model) => (
                        <option key={model.value} value={model.value}>
                            {model.label}
                        </option>
                    ))}
                </SelectField>
            </Flex>

            {/* AI Conversation */}
            <View>
                <AIConversation
                    messages={conversationData.data.messages}
                    isLoading={conversationData.isLoading}
                    handleSendMessage={sendMessageHandler || (() => {})}
                    allowAttachments
                    messageRenderer={{
                        text: ({ text }) => (
                            <ReactMarkdown>{text}</ReactMarkdown>
                        ),
                    }}
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
