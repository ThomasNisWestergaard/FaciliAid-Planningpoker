"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS, avatarEmoji, CARD_VALUES } from "@/lib/constants";

type StoredIdentity = {
  participantToken: string;
  hostToken?: string;
  isHost?: boolean;
  name?: string;
  avatar?: string;
};

type AppMode = "home" | "join";

type StateResponse = {
  session: { id: number; session_code: string; title: string };
  round: {
    id: number;
    round_number: number;
    issue_title: string | null;
    is_revealed: boolean;
  };
  participants: Array<{
    id: number;
    name: string;
    avatar: string;
    is_host: boolean;
    participant_token: string;
    vote_value: string | null;
    has_voted: boolean;
  }>;
  myVote: string | null;
};

function getStoredIdentity(sessionCode: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(`pp:${sessionCode}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredIdentity(sessionCode: string, value: StoredIdentity) {
  localStorage.setItem(`pp:${sessionCode}`, JSON.stringify(value));
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Request failed" };
  }

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export default function AppClient({
  mode,
  initialSessionCode = "",
}: {
  mode: AppMode;
  initialSessionCode?: string;
}) {
  const [sessionCode, setSessionCode] = useState(initialSessionCode.toUpperCase());
  const [joinCode, setJoinCode] = useState(initialSessionCode.toUpperCase());
  const [sessionTitle, setSessionTitle] = useState("Sprint Planning");
  const [displayName, setDisplayName] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showShirtRain, setShowShirtRain] = useState(false);

  const rainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRevealKeyRef = useRef("");

  useEffect(() => {
    setSessionCode(initialSessionCode.toUpperCase());
    setJoinCode(initialSessionCode.toUpperCase());
  }, [initialSessionCode]);

  const identity = useMemo(
    () => (sessionCode ? getStoredIdentity(sessionCode) : null),
    [sessionCode]
  );

  const hasIdentity = !!identity?.participantToken;
  const shouldShowJoinForm = mode === "join" && !hasIdentity;

  async function refreshState(code = sessionCode) {
    if (!code) return;

    const id = getStoredIdentity(code);
    const data = await request(
      `/api/session/state?sessionCode=${encodeURIComponent(code)}&participantToken=${encodeURIComponent(
        id?.participantToken || ""
      )}`
    );

    setState(data);
    setError("");
  }

  useEffect(() => {
    if (!sessionCode || !identity?.participantToken) return;

    refreshState(sessionCode).catch((e) => setError(e.message));

    const poll = setInterval(() => {
      refreshState(sessionCode).catch(() => {});
    }, 2500);

    return () => clearInterval(poll);
  }, [sessionCode, identity?.participantToken]);

  useEffect(() => {
    return () => {
      if (rainTimeoutRef.current) clearTimeout(rainTimeoutRef.current);
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await request("/api/session/create", {
        method: "POST",
        body: JSON.stringify({
          title: sessionTitle,
          hostName: displayName || "Host",
          avatar,
          issueTitle,
        }),
      });

      setStoredIdentity(data.sessionCode, {
        participantToken: data.participantToken,
        hostToken: data.hostToken,
        isHost: true,
        name: data.hostName,
        avatar,
      });

      setSessionCode(data.sessionCode);
      setJoinCode(data.sessionCode);
      window.history.replaceState({}, "", `/`);
      await refreshState(data.sessionCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const code = joinCode.trim().toUpperCase();

      const data = await request("/api/session/join", {
        method: "POST",
        body: JSON.stringify({
          sessionCode: code,
          name: displayName || "Participant",
          avatar,
        }),
      });

      setStoredIdentity(code, {
        participantToken: data.participantToken,
        isHost: false,
        name: data.name,
        avatar,
      });

      setSessionCode(code);
      setJoinCode(code);
      window.history.replaceState({}, "", `/join/${code}`);
      await refreshState(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join session");
    } finally {
      setLoading(false);
    }
  }

  async function submitVote(value: string) {
    if (!sessionCode || !identity?.participantToken) return;

    try {
      await request("/api/vote", {
        method: "POST",
        body: JSON.stringify({
          sessionCode,
          participantToken: identity.participantToken,
          value,
        }),
      });

      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit vote");
    }
  }

  async function hostAction(kind: "reveal" | "reset" | "next") {
    if (!identity?.hostToken) return;

    const route =
      kind === "reveal"
        ? "/api/round/reveal"
        : kind === "reset"
        ? "/api/round/reset"
        : "/api/round/next";

    try {
      await request(route, {
        method: "POST",
        headers: { "X-Host-Token": identity.hostToken },
        body: JSON.stringify({ sessionCode, issueTitle }),
      });

      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${kind} round`);
    }
  }

  const unanimousVote = useMemo(() => {
    if (!state?.round.is_revealed) return null;

    const countedVotes = state.participants
      .map((participant) => participant.vote_value)
      .filter((value): value is string => !!value && value !== "I won't vote");

    if (countedVotes.length === 0) return null;

    const firstValue = countedVotes[0];
    return countedVotes.every((value) => value === firstValue) ? firstValue : null;
  }, [state]);

  useEffect(() => {
    if (!state?.round) return;

    const revealKey = `${state.round.id}-${state.round.is_revealed}-${unanimousVote ?? "none"}`;

    if (state.round.is_revealed && unanimousVote && lastRevealKeyRef.current !== revealKey) {
      lastRevealKeyRef.current = revealKey;
      setShowShirtRain(true);

      if (rainTimeoutRef.current) clearTimeout(rainTimeoutRef.current);

      rainTimeoutRef.current = setTimeout(() => {
        setShowShirtRain(false);
      }, 4000);
    }

    if (!state.round.is_revealed) {
      setShowShirtRain(false);
      lastRevealKeyRef.current = "";
      if (rainTimeoutRef.current) {
        clearTimeout(rainTimeoutRef.current);
        rainTimeoutRef.current = null;
      }
    }
  }, [state?.round, unanimousVote]);

  const rainingShirts = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 7) * 0.15}s`,
        duration: `${2.8 + (index % 5) * 0.35}s`,
        size: `${24 + (index % 4) * 8}px`,
      })),
    []
  );

  const myParticipant = useMemo(() => {
    if (!state || !identity?.participantToken) return null;
    return (
      state.participants.find(
        (participant) => participant.participant_token === identity.participantToken
      ) || null
    );
  }, [state, identity?.participantToken]);

  const shareUrl =
    typeof window !== "undefined" && sessionCode
      ? `${window.location.origin}/join/${sessionCode}`
      : "";

  if (mode === "home" && (!sessionCode || !state)) {
    return (
      <div className="page">
        <div className="shell">
          <header className="hero">
            <h1>Planning Poker</h1>
            <p className="smallMuted">Create a session and share the join link.</p>
          </header>

          <div className="grid">
            <form className="panel" onSubmit={handleCreate}>
              <h2>Start a session</h2>
              <label>Session title</label>
              <input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} />
              <label>Your name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <label>First issue title</label>
              <input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
              <label>Avatar</label>
              <div className="avatarRow">
                {AVATARS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`avatarButton ${avatar === key ? "selected" : ""}`}
                    onClick={() => setAvatar(key)}
                  >
                    <span>{avatarEmoji(key)}</span>
                    <small>{key}</small>
                  </button>
                ))}
              </div>
              <button className="primary" disabled={loading}>
                Create session
              </button>
            </form>

            <div className="panel">
              <h2>How it works</h2>
              <p className="smallMuted">
                Create a session here, then share the participant link. Participants join on a
                separate page and enter their name there.
              </p>
            </div>
          </div>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    );
  }

  if (mode === "join" && shouldShowJoinForm) {
    return (
      <div className="page">
        <div className="shell">
          <header className="hero">
            <h1>Join session {sessionCode}</h1>
            <p className="smallMuted">Enter your name and pick an avatar.</p>
          </header>

          <div className="grid">
            <div className="panel">
              <h2>Session code</h2>
              <p>{sessionCode}</p>
            </div>

            <form className="panel" onSubmit={handleJoin}>
              <h2>Join this session</h2>
              <label>Session code</label>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
              <label>Your name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <label>Avatar</label>
              <div className="avatarRow">
                {AVATARS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`avatarButton ${avatar === key ? "selected" : ""}`}
                    onClick={() => setAvatar(key)}
                  >
                    <span>{avatarEmoji(key)}</span>
                    <small>{key}</small>
                  </button>
                ))}
              </div>
              <button className="primary" disabled={loading}>
                Join session
              </button>
            </form>
          </div>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page">
        <div className="shell">
          <div className="panel">Loading session…</div>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {showShirtRain ? (
        <div className="shirtRainOverlay" aria-hidden="true">
          {rainingShirts.map((shirt) => (
            <span
              key={shirt.id}
              className="shirtRainItem"
              style={{
                left: shirt.left,
                animationDelay: shirt.delay,
                animationDuration: shirt.duration,
                fontSize: shirt.size,
              }}
            >
              👕
            </span>
          ))}
          <div className="shirtRainBanner">Perfect alignment on {unanimousVote}</div>
        </div>
      ) : null}

      <div className="shell">
        <div className="topbar">
          <div>
            <h1>{state.session.title}</h1>
            <p>
              Session code: <strong>{state.session.session_code}</strong> · Round{" "}
              {state.round.round_number}
            </p>
          </div>
          <div className="actionsInline">
            <button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy link</button>
            <button
              onClick={() => {
                localStorage.removeItem(`pp:${sessionCode}`);
                if (mode === "join") {
                  window.location.href = `/join/${sessionCode}`;
                } else {
                  window.location.href = "/";
                }
              }}
            >
              Leave
            </button>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="grid session-grid">
          <section className="panel">
            <h2>Issue</h2>
            <input
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder={state.round.issue_title || "Issue title"}
              disabled={!identity?.hostToken}
            />

            <div className="cards">
              {CARD_VALUES.map((value) => (
                <button
                  key={value}
                  className={`card ${state.myVote === value ? "selected" : ""}`}
                  onClick={() => submitVote(value)}
                  disabled={state.round.is_revealed}
                >
                  {value}
                </button>
              ))}
            </div>

            {identity?.hostToken ? (
              <div className="hostControls">
                <button onClick={() => hostAction("reveal")}>Reveal</button>
                <button onClick={() => hostAction("reset")}>Reset</button>
                <button onClick={() => hostAction("next")}>Next round</button>
              </div>
            ) : null}

            {state.round.is_revealed ? (
              <div className="results">
                <h3>Revealed votes</h3>
                <div className="voteGrid">
                  {state.participants.map((participant) => (
                    <div key={participant.id} className="voteChip">
                      <span>{avatarEmoji(participant.avatar)}</span>
                      <strong>{participant.name}</strong>
                      <em>{participant.vote_value || "—"}</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="hint">Votes stay hidden until the host reveals them.</p>
            )}
          </section>

          <aside className="panel">
            <h2>Participants</h2>
            <div className="participantList">
              {state.participants.map((participant) => (
                <div key={participant.id} className="participant">
                  <div>
                    <span>{avatarEmoji(participant.avatar)} </span>
                    <strong>{participant.name}</strong>
                    {participant.is_host ? <small> Host</small> : null}
                  </div>
                  <div className={`status ${participant.has_voted ? "statusReady" : ""}`}>
                    {state.round.is_revealed
                      ? participant.vote_value || "—"
                      : participant.has_voted
                      ? "Voted"
                      : "Waiting"}
                  </div>
                </div>
              ))}
            </div>

            <div className="meta">
              <p>
                <strong>You:</strong> {myParticipant?.name || identity?.name || "Unknown"}
              </p>
              <p>
                <strong>Your vote:</strong> {state.myVote || "Not voted yet"}
              </p>
              <p>
                <strong>Share:</strong> {shareUrl}
              </p>
              {unanimousVote ? (
                <p>
                  <strong>Consensus:</strong> {unanimousVote}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
