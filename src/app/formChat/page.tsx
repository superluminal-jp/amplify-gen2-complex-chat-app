"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
    Flex,
    Heading,
    Button,
    SelectField,
    TextField,
    TextAreaField,
    View,
} from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

export default function FormChat() {
    const [context, setContext] = useState(
        "Hello, my name is ${Name} and I am ${Age} years old."
    );
    const [formFields, setFormFields] = useState<
        { name: string; value: string }[]
    >([
        { name: "Name", value: "John" },
        { name: "Age", value: "30" },
    ]);

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

    // Add a new form field
    const addFormField = () =>
        setFormFields([...formFields, { name: "", value: "" }]);

    // Update a form field's name or value
    const updateFormField = (
        index: number,
        key: "name" | "value",
        value: string
    ) => {
        const updatedFields = [...formFields];
        updatedFields[index][key] = value;
        setFormFields(updatedFields);
    };

    // Convert form fields into a dictionary for context
    const aiContextData = formFields.reduce((contextData, field) => {
        contextData[field.name] = field.value;
        return contextData;
    }, {} as Record<string, string>);

    // Replace variables in the context
    const processedContext = context.replace(
        /\${(.*?)}/g,
        (_, key) => aiContextData[key] || ""
    );

    return (
        <Flex direction="column" gap="1rem" style={{ width: "80%" }}>
            {/* Header */}
            <Flex>
                <Heading level={1}>Form Chat App</Heading>
            </Flex>

            {/* Dynamic Form Fields */}
            <Flex direction="column" gap="0.75rem">
                {formFields.map((field, index) => (
                    <Flex
                        key={index}
                        direction="row"
                        gap="1rem"
                        alignItems="center"
                    >
                        <TextField
                            width="40%"
                            label="Field Name"
                            placeholder="Enter field name"
                            size="small"
                            value={field.name}
                            onChange={(e) =>
                                updateFormField(index, "name", e.target.value)
                            }
                        />
                        <TextField
                            width="60%"
                            label="Field Value"
                            placeholder="Enter field value"
                            size="small"
                            value={field.value}
                            onChange={(e) =>
                                updateFormField(index, "value", e.target.value)
                            }
                        />
                    </Flex>
                ))}
                <Button variation="primary" size="small" onClick={addFormField}>
                    Add Field
                </Button>
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
                            context: processedContext,
                        };
                    }}
                />
            </View>
        </Flex>
    );
}
