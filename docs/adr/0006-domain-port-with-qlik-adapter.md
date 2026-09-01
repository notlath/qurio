---
status: accepted
---

# The UI depends on our domain model, not on Qlik's API shapes

Screens consume `Thread`, `Interaction`, `Citation`, `Answer` and related types defined in `src/domain/`; a Qlik adapter in `src/qlik/` translates the REST responses into them, and Qlik's JSON never reaches a component. The domain model represents an Agentic Assistant's richer responses — analytics insights and chart-oriented content — from day one, with the classic adapter simply leaving those fields empty.

## Why model agentic capability before we can call it

An abstraction defined as "whatever the classic Assistant returns" would break the UI the moment an agentic adapter replaced it, which is exactly the swap this port exists to enable. Modelling the richer response type up front costs a few optional fields now and is the difference between the port working and being decorative.

The port deliberately does not flatten capability differences into a lowest common denominator: where an Agentic Assistant can do something a classic Assistant cannot, the domain expresses that explicitly.
