/** Pull the first JSON object or array out of a model reply, ignoring text or code fences around it. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("The AI reply had no JSON in it.");
  const close = body[start] === "[" ? "]" : "}";
  const end = body.lastIndexOf(close);
  if (end <= start) throw new Error("The AI reply had incomplete JSON.");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error("The AI reply was not valid JSON.");
  }
}
