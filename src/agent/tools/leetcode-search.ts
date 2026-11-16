const QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      difficulty
      content
      exampleTestcases
      topicTags { name }
      codeSnippets { langSlug code }
    }
  }`;

const toText = (html: string) =>
  html
    .replace(/<sup>(.*?)<\/sup>/g, "^$1") // 10<sup>4</sup> → 10^4
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const leetcodeSearch = async (slugRaw: string) => {
  const slug = slugRaw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
  });
  if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);
  const { data } = await res.json();
  if (!data?.question) throw new Error(`Problem "${slug}" not found`);
  const q = data.question;

  return {
    title: q.title,
    difficulty: q.difficulty,
    description: toText(q.content),
    examples: q.exampleTestcases,
    tags: q.topicTags.map((t: { name: string }) => t.name),
    starterCode: q.codeSnippets.find(
      (s: { langSlug: string }) => s.langSlug === "typescript",
    )?.code,
  };
};
