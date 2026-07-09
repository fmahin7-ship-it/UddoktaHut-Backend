const includesAllTools = (actual, expected) =>
  expected.every((tool) => actual.includes(tool));

const scoreCase = (testCase, result) => {
  const { expect } = testCase;

  if (expect.refuse) {
    const pass = result.refused === true;
    return {
      id: testCase.id,
      pass,
      reason: pass ? "refused as expected" : "should have refused but answered",
      actual: {
        refused: result.refused,
        answer: result.answer?.slice(0, 160),
      },
    };
  }

  if (expect.noTools) {
    const pass = (result.toolsUsed?.length ?? 0) === 0 && result.refused !== true;
    return {
      id: testCase.id,
      pass,
      reason: pass ? "answered without tools" : "unexpected tool calls for greeting",
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
