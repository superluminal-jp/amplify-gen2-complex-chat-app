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

// "use client";

// import { useState } from "react";
// import ReactMarkdown from "react-markdown";
// import { Flex, Heading, TextAreaField, View } from "@aws-amplify/ui-react";
// import { AIConversation } from "@aws-amplify/ui-react-ai";
// import { useAIConversation } from "../../client";

// export default function ContextualChat() {
//     const [context, setContext] = useState("");

//     // chatClaude35Sonnet のみ使用
//     const [conversationData, sendMessageHandler] =
//         useAIConversation("chatClaude35Sonnet");

//     return (
//         <Flex direction="column" gap="1rem" style={{ width: "80%" }}>
//             {/* ヘッダー */}
//             <Flex>
//                 <Heading level={1}>Contextual Chat App</Heading>
//             </Flex>

//             {/* コンテキスト入力 */}
//             <Flex>
//                 <TextAreaField
//                     autoResize
//                     label="Context"
//                     placeholder="Additional knowledge"
//                     resize="vertical"
//                     value={context}
//                     onChange={(e) => {
//                         setContext(e.target.value);
//                     }}
//                     width="100%"
//                 />
//             </Flex>

//             {/* AI会話 */}
//             <View>
//                 <AIConversation
//                     messages={conversationData.data.messages}
//                     isLoading={conversationData.isLoading}
//                     handleSendMessage={sendMessageHandler || (() => {})}
//                     allowAttachments
//                     messageRenderer={{
//                         text: ({ text }) => (
//                             <ReactMarkdown>{text}</ReactMarkdown>
//                         ),
//                     }}
//                     aiContext={() => {
//                         return {
//                             context: context,
//                         };
//                     }}
//                 />
//             </View>
//         </Flex>
//     );
// }
