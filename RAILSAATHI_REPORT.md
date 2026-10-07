# PROJECT REPORT

## RAILSAATHI – AN AI SAFETY AND ASSISTANCE CHATBOT FOR MUMBAI LOCAL TRAIN COMMUTERS

**Submitted By**

[Name]  [Roll No.]
[Name]  [Roll No.]

**Team:** [Team Name]
**Professor:** [Professor Name]

---

## Introduction

Mumbai's suburban railway, the local train network, is one of the busiest commuter systems in the world. It carries roughly 7.5 million passengers every day across the Western, Central and Harbour lines. With such a large number of people travelling in crowded conditions, commuters regularly face problems that need a quick, reliable answer: a stolen phone, harassment in a coach, confusion about helpline numbers, uncertainty about footboard travel, monsoon disruptions, or simply not knowing when the next train leaves.

The information a commuter needs in these moments is scattered. Safety advice sits on one website, helpline numbers on another, and train timings in a separate app. In an emergency, or in a crowded moving train, searching across these sources is slow and stressful.

RailSaathi is a simple, multilingual chatbot built to give commuters a calm, correct answer at the moment they need it. The user types or speaks a question in English, Hindi (हिन्दी) or Marathi (मराठी) and the assistant replies in the same language. It also mirrors Hinglish (Hindi written in Roman script) so everyday users do not have to switch keyboards. The assistant answers questions about safety, security, ticketing, refunds, disruptions and train schedules, and surfaces verified emergency helpline numbers as tap-to-call links.

It is intended for daily commuters, students, women travelling alone, senior citizens and anyone who needs quick railway guidance on the move.

## Problem Statement

The Mumbai suburban network sees a very high number of commuter incidents each year, including thefts, harassment, falls from crowded or moving trains, and accidents linked to footboard travel. During the monsoon, waterlogging and track flooding disrupt services and create additional safety risks. Across all of these situations, the common gap is the same: the commuter does not have **instant, trustworthy, situation-specific guidance** in a language they are comfortable with.

A traveller facing a problem has to answer the same questions every time: *Which number do I call right now? Where do I report this? Is it safe to travel? When is my next train?* The information exists, but it is fragmented, often English-only, and hard to use quickly on a phone in a crowded coach.

There are two specific risks a naive chatbot would introduce:

- **Wrong emergency numbers or invented facts.** If an assistant guesses a helpline number, a fare, or a law, it can send a person in danger to a dead end.
- **Guessed train timings.** A plausible-sounding but incorrect schedule is worse than no answer at all.

RailSaathi is designed directly around these risks. It answers only from a verified knowledge base and real timetable data, never invents helpline numbers, fares or train times, and always points the user to the official source when it does not know.

## Working

RailSaathi is a chat assistant. The user picks a language (English / हिन्दी / मराठी), types or speaks a question, and receives a streamed reply with suggested follow-up questions. The system combines four parts: an **urgency detector**, a small **verified knowledge base**, a **large language model (LLM)** that writes every reply, and **timetable tools** that look up real train schedules.

**1) Urgency detection (runs first, independent of the LLM).**
Before anything else, the user's text is scanned for urgency keywords in all three languages (for example "help", "bleeding", "मदद", "वाचवा"). If an urgent word is found, the interface immediately shows an **Emergency Banner** with tap-to-call helpline numbers. This runs on both the client and the server, so the banner appears instantly, even if the network or the LLM is slow or offline. False positives are harmless because they only surface helpline numbers.

**2) Retrieval from a verified knowledge base.**
The question is matched against a small, hand-written knowledge base of safety topics (theft, harassment, helplines, footboard travel, overcrowding, lost belongings, monsoon disruptions and late-night travel). A lightweight ranking method finds the three most relevant topics. This matched content is used as **reference context only** — it is never shown word-for-word and never used to refuse an answer.

**3) Answer generation (every reply is model-generated).**
The relevant context, the current time in Mumbai, and a strict set of rules are given to the LLM, which writes the final answer. The rules force the model to: reply in the selected language (or mirror Hinglish), use only the verified helpline numbers, never invent fares, timings or phone numbers, give short numbered steps, and put emergency numbers first if the user may be in danger.

**4) Train schedules via tools (never guessed).**
When the user asks about train timings, first/last trains or routes, the model does not guess. It calls server-side tools (`find_station`, `get_next_trains`, `get_train_details`, `get_timetable_info`) that read a local timetable store. The tools do a direct same-line search and, when there is no direct train, a one-change interchange search. If a station or route is not in the data, the tool returns "not covered" and the assistant honestly says so and points to the official Western/Central Railway timetable or an app like m-Indicator. Results are shown in a compact **Train Result Card** with a live "Next in N minutes".

**Safety-first fallbacks.** If the LLM is unavailable or slow, RailSaathi never reaches a dead end: for schedule questions it still answers from local timetable data; for everything else it streams a short note with working helpline numbers and asks the user to try again.

The verified helpline numbers used by the assistant are:

- **112** – National emergency (police, fire, ambulance)
- **182** – RPF (Railway Protection Force) security helpline
- **139** – Railway helpline (Rail Madad) for enquiries and complaints
- **1512** – GRP Mumbai (Government Railway Police)

> Note: In the current build these numbers and all safety content are marked as **draft placeholders** that must be verified against official RPF / GRP / Indian Railways sources before any real deployment.

## RailSaathi Flow Graph

```
                         Start: User opens /chat
                                   |
                     Selects language (English / हिन्दी / मराठी)
                                   |
                     Types or speaks a question (voice input)
                                   |
             ┌─────────────────────┴─────────────────────┐
             |                                            |
   Urgency keywords found?                        No urgency keyword
             |  Yes                                       |
   Show Emergency Banner                                  |
   (tap-to-call helplines,                                |
    LLM-independent)                                      |
             └─────────────────────┬─────────────────────┘
                                   |
                     Retrieve top 3 topics from
                     verified knowledge base (context only)
                                   |
                     Is this a train-schedule question?
             ┌─────────────────────┴─────────────────────┐
             |  Yes                                       |  No
   Call timetable tools                          Build strict prompt
   (find_station,                                (context + current time
    get_next_trains, ...)                         + rules) and send to LLM
             |                                            |
   Covered?                                               |
     Yes → Train Result Card                              |
     No  → "I don't have that                             |
            route; check official                         |
            timetable"                                    |
             └─────────────────────┬─────────────────────┘
                                   |
                     Stream the model-written answer
                     + follow-up suggestion chips
                                   |
         (If LLM/tools fail → safe fallback: schedule data
          or helpline note — never a dead end)
```

## Code and Result

RailSaathi is built as a **Next.js (React + TypeScript)** web application with a streaming chat interface. The language model is accessed through the Groq API (a tool-capable model, with an automatic fallback model if the primary fails). The project is organised into clear parts:

- **Interface** (`src/components/chat/`): the chat shell, message bubbles, emergency banner, voice button, language selector, suggestion chips and the train result card.
- **API** (`src/app/api/`): `/api/chat` (the main streaming pipeline), `/api/translate` (translate any reply), and `/api/train` (full stop list for a trip).
- **Logic** (`src/lib/`): the knowledge base retrieval, urgency detection, verified helplines, system-prompt rules, and the timetable tools and store.
- **Data** (`src/data/`): the draft safety knowledge base (`intents.json`) and the timetable dataset (`timetable.json`).

The overall request flow can be represented as:

```
Select Language → Enter Question (text / voice) → Detect Urgency →
Retrieve Context → (Schedule? → Timetable Tools) → LLM Writes Answer →
Stream Reply + Follow-ups → (Fallback if LLM/tools fail)
```

The reply is streamed token by token so the user sees the answer appear immediately. The visible text has protocol markers stripped automatically, follow-up questions appear as tappable chips, and schedule answers render a structured card.

**Example — safety question.** When a user types "someone stole my phone", RailSaathi gives calm numbered steps: move to a safe or crowded spot, call **RPF 182** or **GRP Mumbai 1512**, note the train number, coach and time, block the SIM and bank apps, and file a complaint to get a report number. For general railway complaints it also notes **139**.

**Example — schedule question.** When a user asks "next train from Dadar to Borivali", the model calls the timetable tools, shows the next 3–5 scheduled trains in a card with a live "Next in N minutes", and clearly states these are **scheduled** timings (not live status) to confirm on the station indicator or m-Indicator.

**Example — urgent message.** A message containing an urgency keyword (for example "help, bleeding") immediately shows the Emergency Banner with tap-to-call numbers, independent of what the model writes.

Important design features of the project:

- **Multilingual + Hinglish**, with the ability to switch language mid-chat (a divider marks the switch and the follow-up chips are re-translated).
- **Voice input** using the Web Speech API, with the microphone locale following the selected language.
- **Accessibility (WCAG 2.2 AA)**: live regions for streamed replies, keyboard support, visible focus rings, large (≥44px) touch targets, reduced-motion support, and colour never used as the only signal.
- **Rate limiting** (per IP) and strict input validation on the server.
- **Never a dead end**: safe local fallbacks keep the assistant useful even when the LLM is unreachable.

## Output Screens

*(Insert screenshots here.)*

- **Chat with safety answer:** a user question answered with calm, numbered steps and tap-to-call helpline links.
- **Emergency Banner:** the banner that appears instantly when urgency keywords are detected.
- **Train Result Card:** next trains from one station to another, with a live "Next in N minutes" and a scheduled-timings disclaimer.
- **Language switch:** the "Language changed to …" divider and re-translated follow-up chips.
- **Voice input:** the microphone listening state during speech input.

## Future Scope

RailSaathi can be improved further by making its content official and its coverage wider.

- **Verify all safety content and helpline numbers** against official RPF / GRP / Indian Railways sources before any real launch. In the current build these are clearly marked as draft placeholders.
- **Load real timetable data.** The shipped dataset is a small sample seed. An offline sync script loads real Mumbai local schedules into a local store that the chat tools read from, so the runtime never depends on a rate-limited external API.
- **Live train status.** The assistant currently gives scheduled timings only; integrating a live-status feed would let it reflect delays, cancellations and Sunday mega blocks.
- **More languages and better reach**, broader station and route coverage, and nearest-help information such as the closest staffed station or RPF/GRP post.
- **Testing with real commuters** across the three lines to measure answer accuracy and improve the knowledge base.

## Conclusion

RailSaathi provides a simple, calm and multilingual way for Mumbai local train commuters to get the right answer at the moment they need it. It combines instant urgency detection, a verified knowledge base, a language model that writes every reply under strict rules, and timetable tools that return real schedules instead of guesses. The result is an assistant that answers safety, security, ticketing and schedule questions in English, Hindi or Marathi, surfaces emergency helplines as tap-to-call links, and is careful to never invent a helpline number, a fare or a train time.

The core goal of RailSaathi is to close the gap between a commuter facing a problem and the correct, trustworthy guidance for that problem. With verified official content, real timetable data, live status and wider language and route coverage, RailSaathi can grow into a dependable everyday companion for one of the world's busiest railway networks.

## References

- Indian Railways / RPF / GRP published helplines and reporting guidance (to be verified).
- Mumbai Suburban Railway (Western, Central and Harbour lines) travel safety advisories.
- RailRadar (unofficial) train data, used only for offline timetable syncing.
