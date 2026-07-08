const throwFocusedTestError = (methodName: string): never => {
  throw new Error(
    `Focused Jest test "${methodName}" is forbidden in CI. Remove .only before committing.`,
  );
};

const defineForbiddenFocusedTest = (
  target: { only?: unknown },
  methodName: string,
) => {
  Object.defineProperty(target, 'only', {
    configurable: true,
    get: () => throwFocusedTestError(methodName),
  });
};

const defineForbiddenFocusedGlobal = (methodName: 'fdescribe' | 'fit') => {
  Object.defineProperty(globalThis, methodName, {
    configurable: true,
    value: () => throwFocusedTestError(methodName),
  });
};

if (!!process.env.CI) {
  defineForbiddenFocusedTest(describe, 'describe.only');
  defineForbiddenFocusedTest(test, 'test.only/it.only');
  defineForbiddenFocusedGlobal('fdescribe');
  defineForbiddenFocusedGlobal('fit');
}
