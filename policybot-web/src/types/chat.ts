export type Role = "user" | "assistant";
export type Citation = { id?: number; title: string; type?: string; section?: string };
export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  toolType?: string;
  createdAt?: number;
};
