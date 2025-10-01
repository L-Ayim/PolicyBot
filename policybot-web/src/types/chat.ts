export type Role = "user" | "assistant";
export type Citation = { title: string; sectionOrPage: string };
export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  createdAt?: number;
};
