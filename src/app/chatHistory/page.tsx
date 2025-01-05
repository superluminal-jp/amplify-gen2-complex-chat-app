"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Flex, Heading, View, Button } from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";

import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: "userPool" });
// authMode: "userPool" required to access chat data

export default function ChatHistory() {
    const selectedModel = "chatClaude3Haiku";
    type Conversation = Schema["chatClaude3Haiku"]["type"][];
    const [conversationListData, setConversationListData] =
        useState<Conversation>([] as Conversation);

    const [
        {
            data: { messages },
            isLoading,
        },
        handleSendMessage,
    ] = useAIConversation(selectedModel);

    const handlerShowChatHistory = async () => {
        const conversationList =
            await client.conversations.chatClaude3Haiku.list();
        // console.log(conversationList);
        // console.log(conversationList.data);
        setConversationListData(conversationList.data);
        console.log("conversation data",conversationListData);
    };

    return (
        <Flex direction="column" gap="1rem" style={{ width: "100%" }}>
            <Flex>
                <Heading level={1}>Chat History App</Heading>
            </Flex>
            <View>
                <AIConversation
                    messages={messages}
                    isLoading={isLoading}
                    handleSendMessage={handleSendMessage}
                    allowAttachments
                    messageRenderer={{
                        text: ({ text }) => (
                            <ReactMarkdown>{text}</ReactMarkdown>
                        ),
                    }}
                />
            </View>

            <Flex>
                <Button onClick={handlerShowChatHistory}>
                    Show Chat History
                </Button>
                {/* {conversationListData &&
                    conversationListData.map((conversation) => (
                        <div key={conversation.id}>
                            <p>{conversation.id}</p>
                            <p>{conversation.created_at}</p>
                        </div>
                    ))} */}
            </Flex>
        </Flex>
    );
}
