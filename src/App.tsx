import { useState } from "react";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import { Profile, emptyProfile, loadProfile, saveProfile } from "./utils/storage";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);

  const update = (p: Profile | null) => {
    setProfile(p);
    saveProfile(p);
  };

  if (!profile) {
    return <Landing onSignIn={(email, name) => update({ ...emptyProfile, email, name })} />;
  }
  if (!profile.year || !profile.university) {
    return <Onboarding profile={profile} onDone={update} onSignOut={() => update(null)} />;
  }
  return <Dashboard profile={profile} onProfileChange={update} onSignOut={() => update(null)} />;
}
