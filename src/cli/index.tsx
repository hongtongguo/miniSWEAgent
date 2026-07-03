#!/usr/bin/env node
import React, { useMemo, useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import { DEFAULT_MODEL } from "../constant";
import agentLoop, { createAgentState } from "../core/agentLoop";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MessageBlock = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={isUser ? "green" : "cyan"}>
        {isUser ? "You" : "AI"}
      </Text>
      <Box
        borderStyle="round"
        borderColor={isUser ? "green" : "cyan"}
        paddingX={1}
      >
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
};

const App = () => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const agentState = useMemo(() => createAgentState(), []);

  const trimmedInput = useMemo(() => input.trim(), [input]);

  const submit = async () => {
    if (!trimmedInput || isLoading) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: trimmedInput,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const aiResponse = await agentLoop(trimmedInput, agentState);

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content: aiResponse || "未收到有效回复。",
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "请求失败，请重试。",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useInput((i, key) => {
    if (key.ctrl && i === "c") {
      exit();
      return;
    }

    if (key.return) {
      void submit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prevInput) => prevInput.slice(0, -1));
      return;
    }

    if (key.escape) {
      setInput("");
      return;
    }

    if (key.tab || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
      return;
    }

    setInput((prevInput) => {
      const newInput = prevInput + i;
      return newInput;
    });
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          miniSWEAgent
        </Text>
        <Text color="gray">  model: {DEFAULT_MODEL}</Text>
      </Box>

      {messages.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="gray">输入你的开发任务，按 Enter 发送，Esc 清空。</Text>
        </Box>
      ) : (
        messages.map((message, index) => (
          <MessageBlock key={`${message.role}-${index}`} message={message} />
        ))
      )}

      {isLoading ? (
        <Box marginBottom={1}>
          <Text color="yellow">AI 正在思考...</Text>
        </Box>
      ) : null}

      {error ? (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      ) : null}

      <Box borderStyle="single" borderColor={isLoading ? "gray" : "blue"} paddingX={1}>
        <Text color={isLoading ? "gray" : "blue"}>{isLoading ? "..." : ">"}</Text>
        <Text> {input}</Text>
      </Box>
    </Box>
  );
};

render(<App />);
