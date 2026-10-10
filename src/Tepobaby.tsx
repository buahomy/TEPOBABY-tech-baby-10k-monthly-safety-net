import { useEffect, useState } from "react";
import Main from "./pages/Main";
import Mess01 from "./pages/Mess01";
import Questions from "./pages/Questions";
import { User, getCurrentUser, signOut } from "./utils/auth";
import {
  Profile,
  clearGuestProfile,
  isComplete,
  loadGuestProfile,
  moveGuestAnswersToAccount,
  saveAnswersAsGuest,
  saveAnswersToServer,
  startGuestProfile,
} from "./utils/profile";

// Signed out → welcome screen.
// Signed in (.edu) → questions until finished → main app (Home tab + bottom nav). Answers saved to the account.
// Guest ("I'll just browse around") → same questions → home. Answers saved on this device,
// and moved into the account if the guest signs in later.

type Who = { kind: "user"; user: User } | { kind: "guest" };

type Stage =
  | { name: "loading" }
  | { name: "welcome"; error?: string }
  | { name: "questions"; who: Who; profile: Profile | null; startAt?: number }
  | { name: "home"; who: Who; profile: Profile };

// Finished students go home; anyone missing an answer (e.g. after questions change) resumes onboarding.
const route = (who: Who, profile: Profile | null): Stage =>
  isComplete(profile) ? { name: "home", who, profile: profile! } : { name: "questions", who, profile };

export default function Tepobaby() {
  const [stage, setStage] = useState<Stage>({ name: "loading" });

  const enterAsUser = async (user: User) => {
    setStage({ name: "loading" });
    try {
      setStage(route({ kind: "user", user }, await moveGuestAnswersToAccount()));
    } catch {
      setStage({ name: "welcome", error: "Signed in, but couldn't load your answers. Please refresh." });
    }
  };

  const enterAsGuest = () => setStage(route({ kind: "guest" }, startGuestProfile()));

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) return enterAsUser(user);
      const guest = loadGuestProfile();
      setStage(guest ? route({ kind: "guest" }, guest) : { name: "welcome" });
    });
  }, []);

  switch (stage.name) {
    case "loading":
      return <div className="m01-loading" aria-busy="true" />;

    case "welcome":
      return <Mess01 onGuest={enterAsGuest} initialError={stage.error} />;

    case "questions": {
      const { who } = stage;
      return (
        <Questions
          firstName={who.kind === "user" ? who.user.name.split(" ")[0] || "there" : "there"}
          initial={stage.profile}
          startAt={stage.startAt}
          save={who.kind === "user" ? saveAnswersToServer : saveAnswersAsGuest}
          onDone={(profile) => setStage({ name: "home", who, profile })}
        />
      );
    }

    case "home": {
      const { who, profile } = stage;
      return (
        <Main
          user={who.kind === "user" ? who.user : null}
          profile={profile}
          onEdit={() => setStage({ name: "questions", who, profile, startAt: 0 })}
          onSignIn={() => setStage({ name: "welcome" })}
          onSignOut={() =>
            who.kind === "user"
              ? signOut().then(() => setStage({ name: "welcome" }))
              : (clearGuestProfile(), setStage({ name: "welcome" }))
          }
        />
      );
    }
  }
}
