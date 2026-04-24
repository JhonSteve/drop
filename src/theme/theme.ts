import { dropBreakpoints, dropTokens, type DropColorToken, type DropThemeName } from "./tokens";

export const dropCssVarName = (token: DropColorToken) => `--${token.replace(/\./g, "-")}`;

export const dropCssVar = (token: DropColorToken) => `var(${dropCssVarName(token)})`;

export const buildDropThemeVariables = (theme: DropThemeName) =>
  Object.fromEntries(
    Object.entries(dropTokens[theme]).map(([token, value]) => [dropCssVarName(token as DropColorToken), value]),
  );

export const paperThemeMeta = {
  lightThemeColor: dropTokens.light["bg.canvas"],
  darkThemeColor: dropTokens.dark["bg.canvas"],
  lightActionColor: dropTokens.light["action.primary"],
  darkActionColor: dropTokens.dark["action.primary"],
  lightBgColor: dropTokens.light["bg.canvas"],
  darkBgColor: dropTokens.dark["bg.canvas"],
  maxTransferBytes: 500 * 1024 * 1024,
  touchTarget: 44,
  breakpoints: dropBreakpoints,
} as const;

