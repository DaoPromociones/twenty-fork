export const generateGqlFields = (count: number): string => {
  return Array.from({ length: count }, (_, index) => `field${index}: id`).join(
    '\n',
  );
};
