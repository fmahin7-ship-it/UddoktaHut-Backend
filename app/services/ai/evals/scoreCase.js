const includesAllTools = (actual, expected) =>
  expected.every((tool) => actual.includes(tool));

const DECLINE_PATTERNS = [
  /only help with/i,
  /store data/i,
  /can'?t provide/i,
  /cannot provide/i,
  /can'?t help with that/i,
  /cannot help with that/i,
  /off[- ]?topic/i,
  /not able to (help|answer|provide)/i,
];

const looksLikeSoftRefuse = (answer, toolsUsed) => {
  if ((toolsUsed?.length ?? 0) > 0) return false;
  if (!answer || typeof answer !== "string") return false;
  return DECLINE_PATTERNS.some((re) => re.test(answer));
};

const scoreCase = (testCase, result) => {
  const { expect } = testCase;

  if (expect.refuse) {
    const hardRefuse = result.refused === true;
    const softRefuse = looksLikeSoftRefuse(result.answer, result.toolsUsed);
    const pass = hardRefuse || softRefuse;

    return {
      id: testCase.id,
      pass,
      reason: pass
        ? hardRefuse
          ? "refused as expected"
          : "soft refuse (declined off-topic without tools)"
        : "should have refused but answered",
      actual: {
        refused: result.refused,
        softRefuse,
        toolsUsed: result.toolsUsed ?? [],
        answer: result.answer?.slice(0, 160),
      },
    };
  }

  if (expect.noTools) {
    const pass =
      (result.toolsUsed?.length ?? 0) === 0 && result.refused !== true;
    return {
      id: testCase.id,
      pass,
      reason: pass
        ? "answered without tools"
        : "unexpected tool calls for greeting",
      actual: {
        toolsUsed: result.toolsUsed ?? [],
        answerPreview: result.answer?.slice(0, 160),
      },
    };
  }

  if (expect.minTools) {
    const count = result.toolsUsed?.length ?? 0;
    const pass = count >= expect.minTools;
    return {
      id: testCase.id,
      pass,
      reason: pass ? "minimum tool count met" : "not enough tools called",
      actual: { toolsUsed: result.toolsUsed ?? [] },
      expected: { minTools: expect.minTools },
    };
  }

  const expectedTools = expect.tools ?? [];
  const pass = includesAllTools(result.toolsUsed ?? [], expectedTools);

  return {
    id: testCase.id,
    pass,
    reason: pass ? "tools matched" : "wrong or missing tools",
    actual: {
      toolsUsed: result.toolsUsed ?? [],
      answerPreview: result.answer?.slice(0, 160),
    },
    expected: { tools: expectedTools },
  };
};

export { scoreCase };
