import {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
  ReactNode,
} from "react";

type ThemeUpdateFunction = Dispatch<SetStateAction<boolean>>;

const ThemeContext = createContext<boolean>(true);
const ThemeUpdateContext = createContext<ThemeUpdateFunction | undefined>(
  undefined,
);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<boolean>(true);

  function handleTheme(newTheme: boolean | ((prevTheme: boolean) => boolean)) {
    setTheme(newTheme);
  }

  return (
    <ThemeContext.Provider value={theme}>
      <ThemeUpdateContext.Provider value={handleTheme}>
        {children}
      </ThemeUpdateContext.Provider>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;

export function useTheme() {
  return useContext(ThemeContext);
}

export function useUpdateTheme() {
  return useContext(ThemeUpdateContext);
}
