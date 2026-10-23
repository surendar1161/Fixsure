import { requireStaff } from "@/lib/auth";
import { runCopilot, type CopilotMessage } from "@/lib/copilot";
import { ApiError } from "@/lib/errors";
import { handler, json, readJson } from "@/lib/http";

export const POST = handler(async (request) => {
  requireStaff(request);
  const body = await readJson(request);
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
    throw new ApiError("validation", "Send 1 to 20 messages.", [{ field: "messages", message: "Must be an array of 1 to 20 messages." }]);
  }
  const messages: CopilotMessage[] = raw.map((item, index) => {
    const role = item?.role;
    const content = item?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > 2000) {
      throw new ApiError("validation", "Each message needs a role of user or assistant and 1 to 2000 characters of content.", [
        { field: `messages[${index}]`, message: "Invalid message." },
      ]);
    }
    return { role, content: content.trim() };
  });
  if (messages.at(-1)!.role !== "user") throw new ApiError("validation", "The last message must be from the user.");
  return json(await runCopilot(messages));
});
