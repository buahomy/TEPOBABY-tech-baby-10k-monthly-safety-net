import { useEffect, useRef, useState } from "react";
import { loadSelectedJobId, saveSelectedJobId } from "../utils/ginny";
import BottomNav, { Tab } from "../components/BottomNav";
import PhoneShell from "../components/PhoneShell";
import { User } from "../utils/auth";
import { Profile } from "../utils/profile";
import { useSavedJobs } from "../utils/savedJobs";
import GinnySheet from "./GinnySheet";
import ConnectTab from "./tabs/ConnectTab";
import HomeTab from "./tabs/HomeTab";
import InterviewTab from "./tabs/InterviewTab";
import ProfileTab from "./tabs/ProfileTab";
import "./main.css";
import "./onboarding.css";

// The app after onboarding: tab content above a bottom navigation bar. Home is the default tab.

type Props = {
  user: User | null; // null = guest
  profile: Profile;
  onEdit: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

export default function Main({ user, profile, onEdit, onSignIn, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>("home");
  const [ginnyOpen, setGinnyOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(loadSelectedJobId);
  const scroller = useRef<HTMLDivElement>(null);
  const firstName = user?.name.split(" ")[0] || "there";
  const saved = useSavedJobs(!!user);

  // Each tab opens at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <PhoneShell label="tepobaby" className="phone-frame--flex">
      <div className="main">
        <div className="main-scroll" ref={scroller}>
          {tab === "home" && <HomeTab firstName={firstName} profile={profile} saved={saved} />}
          {tab === "interview" && <InterviewTab profile={profile} />}
          {tab === "connect" && (
            <ConnectTab
              user={user}
              profile={profile}
              saved={saved}
              selectedId={selectedJobId}
              onSelect={(id) => {
                setSelectedJobId(id);
                saveSelectedJobId(id);
              }}
              onBrowse={() => setTab("home")}
            />
          )}
          {tab === "profile" && (
            <ProfileTab
              user={user}
              profile={profile}
              saved={saved}
              onBrowse={() => setTab("home")}
              onEdit={onEdit}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
            />
          )}
        </div>

        <BottomNav active={tab} onSelect={setTab} onPlus={() => setGinnyOpen(true)} />

        {ginnyOpen && (
          <GinnySheet
            user={user}
            profile={profile}
            saved={saved}
            selectedId={selectedJobId}
            onSelect={(id) => {
              setSelectedJobId(id);
              saveSelectedJobId(id);
            }}
            onBrowse={() => {
              setGinnyOpen(false);
              setTab("home");
            }}
            onClose={() => setGinnyOpen(false)}
          />
        )}
      </div>
    </PhoneShell>
  );
}
