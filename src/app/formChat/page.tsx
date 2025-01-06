"use client";

import { useState, useMemo } from "react";
import {
    Flex,
    Heading,
    View,
    Button,
    TextField,
    TextAreaField,
} from "@aws-amplify/ui-react";
import { AIConversation } from "@aws-amplify/ui-react-ai";
import { useAIConversation } from "../../client";

export default function FormChat() {
    const selectedModel = "chatClaude35Sonnet";

    // フォームの入力項目を配列で管理
    const [formFields, setFormFields] = useState([
        { name: "Name", value: "John" },
        { name: "Age", value: "30" },
    ]);

    // 新規追加用のフィールド名・値を管理
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldValue, setNewFieldValue] = useState("");

    // コンテキスト文字列（${Name} や ${Age} などを含む）
    const [context, setContext] = useState(
        "Hello, my name is ${Name} and I am ${Age} years old."
    );

    // フィールドの編集処理
    const updateFormField = (
        index: number,
        key: "name" | "value",
        newValue: string
    ) => {
        setFormFields((prevFields) => {
            const updatedFields = [...prevFields];
            updatedFields[index][key] = newValue;
            return updatedFields;
        });
    };

    // フィールドの追加処理
    const addFormField = () => {
        if (!newFieldName) return; // フィールド名がない場合は何もしない
        setFormFields((prev) => [
            ...prev,
            { name: newFieldName, value: newFieldValue },
        ]);
        setNewFieldName("");
        setNewFieldValue("");
    };

    // フィールドの削除処理
    const removeFormField = (index: number) => {
        setFormFields((prev) => prev.filter((_, i) => i !== index));
    };

    // formFields（配列）から { Name: "xxx", Age: "yyy", ... } の形に整形
    const formDataObject = useMemo(() => {
        const obj: Record<string, string> = {};
        formFields.forEach((field) => {
            obj[field.name] = field.value;
        });
        return obj;
    }, [formFields]);

    // AIモデルとのやりとり
    const [
        {
            data: { messages },
            isLoading,
        },
        handleSendMessage,
    ] = useAIConversation(selectedModel);

    // コンテキスト文字列の中にある ${FieldName} を実際の値に置換
    const processedContext = useMemo(() => {
        return Object.entries(formDataObject).reduce(
            (acc, [key, value]) => acc.replace(`\${${key}}`, value),
            context
        );
    }, [formDataObject, context]);

    return (
        <Flex direction="column" gap="1rem" style={{ width: "100%" }}>
            <Flex>
                <Heading level={1}>Form Chat App</Heading>
            </Flex>

            {/* 既存のフィールド一覧表示・編集 */}
            {formFields.map((field, index) => (
                <Flex key={index} gap="1rem" alignItems="flex-end" width="100%">
                    <TextField
                        label="Field Name"
                        placeholder="e.g., Hobby"
                        value={field.name}
                        onChange={(e) =>
                            updateFormField(index, "name", e.target.value)
                        }
                        width="40%"
                    />
                    <TextField
                        label="Field Value"
                        placeholder="e.g., Chess"
                        value={field.value}
                        onChange={(e) =>
                            updateFormField(index, "value", e.target.value)
                        }
                        width="60%"
                    />
                    <Button onClick={() => removeFormField(index)}>
                        Remove
                    </Button>
                </Flex>
            ))}

            {/* 新しくフィールドを追加するためのエリア */}
            <Flex gap="1rem" alignItems="flex-end" width="100%">
                <TextField
                    label="New Field Name"
                    placeholder="e.g., Hobby"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    width="40%"
                />
                <TextField
                    label="New Field Value"
                    placeholder="e.g., Soccer"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    width="60%"
                />
                <Button onClick={addFormField}>Add Field</Button>
            </Flex>

            {/* context エディタ */}
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

            {/* プレビューエリア */}
            <Heading level={4}>Context Preview</Heading>
            <Flex>{processedContext}</Flex>

            <View>
                <AIConversation
                    messages={messages}
                    isLoading={isLoading}
                    handleSendMessage={handleSendMessage}
                    allowAttachments
                    // 変数展開後の context を会話に渡す
                    aiContext={() => ({
                        context: processedContext,
                    })}
                />
            </View>
        </Flex>
    );
}
