import { useEffect, useRef, useState } from "react";
import BottomNav, { Tab } from "../components/BottomNav";
import PhoneShell from "../components/PhoneShell";
import { User } from "../utils/auth";
import { Profile } from "../utils/profile";
import { useSavedJobs } from "../utils/savedJobs";
import ComingSoonTab from "./tabs/ComingSoonTab";
import HomeTab from "./tabs/HomeTab";
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
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const firstName = user?.name.split(" ")[0] || "there";
  const saved = useSavedJobs(!!user);

  // Each tab opens at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);
  // Free the preview image when the sheet closes.
  useEffect(() => {
    if (!upload) return;
    return () => URL.revokeObjectURL(upload.url);
  }, [upload]);

  return (
    <PhoneShell label="tepobaby" className="phone-frame--flex">
      <div className="main">
        <div className="main-scroll" ref={scroller}>
          {tab === "home" && <HomeTab firstName={firstName} profile={profile} saved={saved} />}
          {tab === "interview" && (
            <ComingSoonTab
              title="Interview"
              points={[
                "STAR answer practice with AI feedback",
                "Fresh interview questions by company and role",
                "Elevator pitch builder for “Tell me about yourself”",
              ]}
            />
          )}
          {tab === "connect" && (
            <ComingSoonTab
              title="Connect"
              points={[
                "Find alumni from your school at each company",
                "Informational interview question templates",
                "Clubs and organizations picked for you",
              ]}
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

        <BottomNav active={tab} onSelect={setTab} onUpload={() => fileInput.current?.click()} />

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setUpload({ url: URL.createObjectURL(file), name: file.name });
          }}
        />

        {upload && (
          <div className="sheet-backdrop" onClick={() => setUpload(null)}>
            <div className="sheet" role="dialog" aria-label="Image preview" onClick={(e) => e.stopPropagation()}>
              <img className="sheet-image" src={upload.url} alt={upload.name} />
              <p className="sheet-title">Image uploads are coming soon</p>
              <p className="sheet-text">
                Soon you'll be able to snap a job posting or interview question and Tepobaby will read it for you. Your
                image stays on your device for now.
              </p>
              <button type="button" className="primary-action tab-cta" onClick={() => setUpload(null)}>
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
