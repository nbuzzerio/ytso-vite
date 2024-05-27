import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../AuthContext/AuthContext";

const SubsContext = createContext<any[]>([]);
const SubsUpdateContext = createContext<any>("");

export function useSubs() {
  return useContext(SubsContext);
}

export function useUpdateSubs() {
  return useContext(SubsUpdateContext);
}

function SubsProvider({ children }: { children: React.ReactNode }) {
  const [subs, setSubs] = useState<any[]>([]);
  const auth = useAuth();

  function handleSubs(subs: string[]) {
    setSubs(subs);
  }

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (auth)
      fetch(`${window.location.origin}/ytso/api/subs`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": auth,
        },
        signal,
      })
        .then((res) => {
          if (!res.ok) console.log("Respons status: ", res.status, res);
          return res.json();
        })
        .then((data) => {
          if (data.error) console.error(data.error);
          else {
            setSubs(data);
          }
        })
        .catch((er) => console.log(er));

    return () => {
      controller.abort();
    };
  }, [auth]);

  return (
    <SubsContext.Provider value={subs}>
      <SubsUpdateContext.Provider value={handleSubs}>
        {children}
      </SubsUpdateContext.Provider>
    </SubsContext.Provider>
  );
}

export default SubsProvider;
