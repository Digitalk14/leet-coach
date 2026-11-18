const QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      difficulty
      content
      exampleTestcases
      topicTags { name }
      codeSnippets { langSlug code }
      metaData
    }
  }`;

type Meta = { name: string; params: { name: string; type: string }[] };
const parseTests = (raw: string, paramCount: number): unknown[][] => {
  const lines = raw.split("\n").filter(Boolean);
  const tests: unknown[][] = [];
  for (let i = 0; i < lines.length; i += paramCount) {
    const test = lines.slice(i, i + paramCount).map(line => JSON.parse(line));
    tests.push(test);
  }
  // твой код: бери по paramCount строк, каждую через JSON.parse
  return tests;
};

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

export const leetcodeSearch = async (
  slugRaw: string,
  programmingLanguage: string,
) => {
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
  const meta: Meta = JSON.parse(q.metaData);
  const tests = parseTests(q.exampleTestcases, meta.params.length);

  return {
    title: q.title,
    difficulty: q.difficulty,
    description: toText(q.content),
    examples: q.exampleTestcases,
    tags: q.topicTags.map((t: { name: string }) => t.name),
    starterCode: q.codeSnippets.find(
      (s: { langSlug: string }) => s.langSlug === programmingLanguage,
    )?.code,
    functionName: meta.name,
    tests,
  };
};
