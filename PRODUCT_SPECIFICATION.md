# Ouroboros Product Specification

## Authority and Scope

This document defines the required product identity, behavior, and proof of Ouroboros. It is
subordinate to the [`Core Doctrine`](CORE_DOCTRINE.md) and the sovereign boundaries resolved in
[`SOVEREIGN.md`](SOVEREIGN.md), and it is informed by the reasoning in the
[`Whitepaper`](WHITEPAPER.md). Architecture, engineering decisions, and implementation must satisfy
this specification without treating its current methods as permanent.

## 1. Identity and Product Outcome

Ouroboros is an agent-native quantitative firm.

Agents are its primary economic and technical actors. They conduct trading and use evidence from
market and operational consequences to retain, revise, reduce, or stop the firm's strategies,
capabilities, organization, and activities. Humans retain sovereignty over the firm but are not
its routine operators.

The owner provides the initial capital and decides whether, when, and how much additional capital
to contribute. The economic results of the operation accrue to that owner. The human sovereign is
the source of authority over the purpose and mandate; in the current arrangement the owner also
holds that role. These roles are distinct even when held by the same person. A transfer of funds,
code access, or maintenance responsibility does not itself confer sovereign or operating
authority. The terms firm and owner do not prescribe a legal entity, share structure, or the
recruitment of outside shareholders.

Within the inviolable boundaries of the Core Doctrine and human sovereignty, the terminal
objective is to generate economically worthwhile returns for the owner through authorized live
trading of actual capital, pursuing the long-term growth of both profits withdrawn by the owner
and net capital remaining in operation. Continued use of initial contributions, additional
contributions, and retained profits must remain justified relative to realistic alternative uses
under the mandate.

Actual net capital, referred to below as equity, is the firm-wide residual economic value of
assets net of liabilities and obligations. This economic measure does not prescribe an ownership
structure. Profits withdrawn and the owner's remaining economic interest must be considered
together with initial and additional contributions, capital withdrawals, and their timing, without
double-counting. Retained profits remain the owner's capital. Joint growth neither guarantees
increases every period nor creates a regular withdrawal obligation. Increasing cumulative
withdrawals alone does not establish growth in earned profits; their source, the ability to earn,
and the capital left in operation remain relevant.

Judge outcomes after trading losses, execution and financing costs, model, compute, data, operating,
maintenance, and verification costs, and other obligations, including costs paid separately by the
owner. Do not count the same cost twice or conceal valuation uncertainty. Distinguish contributions, borrowing,
returned principal, realized and unrealized gains, actual withdrawals, and trading performance.
Financing inflows and returned principal are not earned trading profit. This distinction neither
authorizes nor prohibits a particular financing arrangement. Changing accounts, reporting
boundaries, or capital denominators cannot manufacture economic gain. Additional contributions
cannot be represented as trading gains or as the recovery of prior trading losses.

The mandate must resolve comparison conditions and horizon, risk and capital bounds, and relevant
liquidity and profit-withdrawal/reinvestment choices before they govern consequential allocation.
Applicable obligations and economic recognition and valuation methods must be established before
dependent reporting and operation. An unresolved choice is not permission for an agent to invent
a favorable default. It need not prevent independent bounded research within existing authority.

Live trading of actual capital is constitutive of the operating product. Research, development,
evaluation, simulation, and paper trading may prepare and improve the firm, but they cannot
substitute permanently for participation in live markets with actual capital.

## 2. Product Boundary

Ouroboros is a quantitative firm, not a research system, an agent orchestration platform, a
backtesting or simulation product, a trading dashboard, or a generator of isolated trading bots.

Research, development, evaluation, simulation, paper trading, software construction, and agent
organization are internal means through which the firm develops its capacity to trade. Their
product legitimacy derives only from their contribution to the owner's objective through
authorized live trading or the constitutive conditions required to pursue it.

An activity belongs to Ouroboros only when it is conducted under the firm's delegated authority,
attributable to the firm, and accountable to its terminal objective. Merely connecting an agent,
tool, model, service, or trading venue does not make it part of the firm.

The current implementation direction separates a public outer execution environment from private
inner AI operation. The outer environment enforces valid delegated authority and resource
conditions, provides authorized execution capabilities, and supplies evidence of actual use,
effects, costs, and obligations. The inner operation originates and governs research, trading,
resource allocation, evaluation, learning, and self-development within those conditions. The outer
environment enforces authority; it does not originate that authority or replace the inner
operation's economic judgment.

This separation must reduce dependence on a particular strategy, model, organization, or execution
implementation while preserving the meaning of authority, available resources, actual effects,
and responsibility. The inner operation must know and adapt to the capital, costs, capabilities,
and constraints it is given. Reuse under different conditions does not establish the same earning
ability or economic viability. Compatibility does not waive eligibility or change conditions in
the current mandate. Neither side must remain permanently unchanged, and changes may require
coordinated revision when the meaning of their relationship changes.

Public source, execution authority, information access, and economic attribution are separate
boundaries. Publishing the outer implementation does not publish credentials, accounts, actual
settings, strategies, trades, or operating evidence by default, nor does it grant a reader
execution authority. Private inner operation must not prevent the sovereign and authorized
evaluators from obtaining the evidence needed for their responsibilities. The outer environment's
conformance must be assessable without requiring publication of the particular private strategy;
claims about an actual operation still require evidence tied to that operation. Separate
repositories alone establish neither enforcement nor economic accountability.

These are two responsibilities within one accountable firm, not two independent economic purposes
or a prescribed number of services, processes, or legal entities. Separate public and private
repositories are the intended implementation direction. Repository names, interfaces,
deployment arrangements, and the exact publication scope remain implementation choices. A public
foundation is a means to the firm's purpose, not an independent platform objective. Astra is the
owner's intended implementation agent; this does not select or establish its ability as an
operating model for the firm.

Ouroboros is specified by the capabilities it must possess and the economic consequences for which
it must remain accountable, not by a fixed architecture. No particular number of agents,
organizational structure, role system, model, strategy, workflow, schema, or method of improvement
is part of its permanent product identity. These forms remain provisional and may be revised,
replaced, or abandoned when justified by evidence.

## 3. Required Product Capabilities

### 3.1 Live Market Agency

Ouroboros must enable its agents to perceive live-market conditions, make trading decisions,
submit and manage real orders through authorized execution means, and account for the resulting
executions, positions, obligations, costs, and consequences to actual equity. The firm must
originate and govern its trading decisions rather than depend on a continuously operating human
or a separate trading decision-maker. An outer environment or trading venue may enforce and carry
out authorized execution without becoming the firm's economic decision-maker.

An intended order, accepted request, execution, settlement, and unresolved outcome must not be
treated as interchangeable. Subsequent management must respond to actual effects and visible
uncertainty rather than assume that a requested or apparently failed action had its intended
effect. The execution environment must understand the trading and obligation distinctions needed
for enforcement without requiring the inner operation's complete strategy or reasoning.

### 3.2 Firm Continuity

Ouroboros must persist as a firm beyond any individual agent, model, strategy, process, or
execution session. Its purpose, delegated authority, equity, obligations, evidence, decisions, and
accountability belong to the firm rather than to the particular agents currently acting through
it. Agents may be created, replaced, reorganized, or removed without resetting the identity,
memory, responsibility, or economic continuity of Ouroboros. This continuity includes open orders,
positions, pending effects, liabilities, costs, and revocations across either implementation's
replacement. Additional owner contributions do not reset past results or outstanding obligations.

### 3.3 Self-Directed Firm Operation

Ouroboros must be capable of originating and governing its own work. Within the delegated mandate,
agents must be able to identify opportunities and problems, determine which work is justified,
allocate attention, computation, equity, and existing authority, coordinate action, evaluate
results, and discontinue work whose justification no longer holds. The human sovereign defines
the mandate; the firm must not depend on humans to continuously supply its tasks, priorities, or
organization.

Purpose relevance, actual authority, and the current case for resources must remain separately
assessable. A permitted action may be unrelated to the purpose or lack a current allocation
rationale; a useful action may lack the authority to execute. Access permission alone does not
resolve these judgments.

Indirect work and coherent multi-step inquiry need not produce immediate revenue. Useful learning
is not automatic justification for more capital; continuation must use current evidence and
alternatives, including cumulative firm-level commitments. Sunk expenditure alone is insufficient.
Maintenance, control, and recovery may be necessary means to the purpose. The firm must be able to
retain a useful method, wait, reduce activity, or discontinue unjustified work without treating
activity, self-development, or continued existence as objectives in themselves. Decisions within
the mandate remain autonomous; changes reserved to the sovereign remain proposals for that
decision-maker.

### 3.4 Unified Capital Stewardship

The owner's actual capital is entrusted to Ouroboros as firm-level equity under the mandate of the
human sovereign; it does not belong independently to an agent, strategy, desk, or experiment.
Within the sovereign upper bound, the firm must be able to allocate, reallocate, limit, and revoke
the use of equity while maintaining a unified account of aggregate exposure, obligations, costs,
and economic consequences.

Within that mandate, agents may autonomously enter, size, reduce, reallocate, or end live-market
exposure. Any net expansion beyond the existing mandate requires explicit sovereign authorization.
Stronger evidence may justify greater exposure, but evidence never creates authority by itself.
Existing conditional rules may authorize adjustment; agents may not unilaterally amend those rules.
An owner contribution, greater available balances, retained profits, confidence, and performance
pressure create no additional authority. Individual allowances must not conceal cumulative or
correlated firm exposure, and modeled loss bounds must not be presented as guaranteed realized
limits.

Local performance may inform allocation, but no local actor, metric, or objective may supersede the
terminal objective or represent changes in capital allocation as firm-level return.

The owner decides additional contributions; the firm may explain their prospective use and
autonomously allocate available resources within its mandate. Their amount, timing, and decision
origin must remain distinguishable from agent-directed allocation, cash holding, and proposals to
withdraw profits. The economic case for additional capital must consider usable opportunities,
incremental costs and risks, effects on the whole operation, and alternatives. Neither a larger
absolute profit nor a lower return rate determines that case by itself.

### 3.5 Institutional Learning

Ouroboros must possess institutional memory that persists beyond individual agents, models,
strategies, and experiments. It must transform attributable market and research consequences into
reusable knowledge while preserving the evidence, uncertainty, contradictions, and lineage
necessary to reconstruct how that knowledge was formed. Agent replacement or organizational
change may alter the firm's judgment, but may not erase its learning history or present inherited
conclusions as newly established truth.

Stored evidence, current interpretation, and observable use of experience must remain distinct.
A lesson's relevance may change without erasing its basis. Compression must not turn a conditional
claim into certainty. Retention must serve the purpose within applicable obligations, access
limits, and costs; no particular memory or model-training mechanism is required. A successor's
competence needs evidence and its recalled permissions cannot override the current mandate.

The preservation and legitimate availability of material evidence must not depend on the survival
of a single inner process. This requires continuity, not publication of all research or a
particular location for institutional memory.

### 3.6 Internal Self-Development

Ouroboros must be capable of developing itself as an internal function of the firm. Within
delegated authority, agents must be able to originate hypotheses, conduct research, design and
implement changes, evaluate alternatives, and revise or replace strategies, models, tools, code,
and organizational forms. Routine continuation of this process may not depend on an external
development team.

Technical capability, net firm results, and economic value to the owner are separate claims. An
improvement must have a testable path from the bottleneck it changes to economic consequences after
full costs at usable scale. Faster iteration, a new model, or more agents is not itself economic
advantage. AI may choose ordinary software or retain a working method when justified.

### 3.7 Governed Selection and Deployment

Ouroboros must be capable of selecting, deploying, observing, limiting, and replacing its own
changes while operating. Authority to create a candidate does not by itself confer authority to
validate, deploy, or expand its consequences. These functions need not belong to permanently
separate agents or organizational units, but no participant in an iteration may become the sole
authority over its outcome or unilaterally control the complete chain by which a candidate is
judged and granted consequential authority.

This restriction also applies to changes in the outer environment, its controls, and its
evaluators. Maintenance authority does not let a change's author unilaterally revise the evidence,
acceptance conditions, and consequential authority by which that same change is accepted. Ordinary
authorized changes may be automated; a net expansion of authority remains outside that automation's
discretion.

A valid iteration may improve what Ouroboros knows without improving how it trades. Ouroboros may
recognize a change as trading improvement only when attributable evidence distinguishes it from
its alternatives, the candidate does not solely control that evidence or its judgment, and
favorable, null, negative, and contradictory outcomes remain part of the record. Any claim
established without live exposure of actual capital remains provisional; trading improvement must
ultimately withstand repeated live-market consequences.

Preserve actual outcomes while distinguishing decision quality, conditional earning ability, and
the next allocation case. Examine selection and alternative explanations; missing evidence is
neither proven ability nor proven absence of ability. Favorable outcomes cannot excuse violations,
and a sound-process claim cannot exempt persistent losses from evaluation.

AI-to-AI checking is an optional candidate mechanism. Claims of effective scrutiny must be tested
for relevant evidence access, consequential challenge, correlated errors, false blocks, bypass,
delay, and cost. Agreement alone is neither verification nor permission. No agent count, voting
rule, or unconditional veto is required.

### 3.8 Governed Autonomy

Agents must be able to conduct trading and self-improvement without continuous human operation or
routine approval. The product must nevertheless preserve effective human sovereign control over
the terminal objective and doctrine, the equity made available and its upper bound, the authority
to halt, revoke, or retire the system, and any net expansion of authority. Everything else may be
delegated and automated within those boundaries.

Ouroboros must provide agents with the greatest autonomy possible within the least authority
sufficient for their delegated purpose. Authority boundaries must remain enforceable independently
of the agents they constrain, and consequential actions must remain attributable to the mandate,
agent, decision, and evidence from which they arose. The firm must be able to contain consequences,
revoke authority, and recover control without relying on blanket prohibition or continuous human
approval.

The mandate's limits must apply to all consequential action attributable to the firm regardless
of the execution path or division of work. An alternate tool, credential, descendant, or
replacement must not provide a route around those conditions. Purpose fit and economic merit
cannot be reduced to mechanical permissions alone; the firm must retain evidence supporting those
judgments as well.

The sovereign must be able to inspect decision-relevant outcomes, commitments, uncertainty, and
supporting evidence in time to exercise control. Where human response is slower than potential
consequences, operation must use already-authorized bounded responses; notification alone is not
control. Absence creates no new permission and does not itself invalidate existing delegation.
Revocation must affect relevant descendants and successors. Stopping new action must remain
distinguishable from resolving outstanding exposure and obligations.

### 3.9 Integrated Firm Operation

Ouroboros must integrate trading, capital allocation, research, development, evaluation,
deployment, governance, and institutional learning into the operation of one accountable firm. A
collection of agents that performs these activities separately is not sufficient. Equity,
authority, evidence, decisions, changes, costs, obligations, and market consequences must
participate in a continuous firm-level loop governed by the same terminal objective.

That loop must join inner decisions to authorized actual effects and feed their costs, obligations,
outcomes, and uncertainty into subsequent decisions. Both implementations' attributable costs,
delays, failures, and human burdens belong in the whole-operation assessment. Costs paid by the
owner outside either repository must not disappear, and shared infrastructure costs must not be
arbitrarily assigned in full to one operation. Allocation must preserve the total economic burden
and must not shift costs to favor a reported result. Actual burdens and support conditions must remain
distinguishable from prospective maintenance or replacement costs.

## 4. Minimum Product Proof

Ouroboros is demonstrated as an operating product only when one accountable firm-level loop has,
within the sovereign mandate and without routine human operation:

- originated a trading decision through agents;
- committed actual equity to authorized live-market orders;
- accounted for the resulting executions, positions, obligations, costs, and net economic
  consequences relative to the equity employed;
- retained those attributable consequences as evidence; and
- used that evidence to govern a subsequent decision to retain, revise, replace, pause, reduce,
  or stop its trading activity within the applicable authority.

The economic consequence need not be favorable. A loss may complete the product proof when it
remains bounded, truthfully accounted for, retained as evidence, and incorporated into what the
firm does next. The proof establishes that the firm-level loop operates; it does not establish that
Ouroboros has achieved enduring trading value or that allocating further owner capital is
attractive relative to alternatives. Operational, evidential, economic, and authority claims must
remain separate.

Simulation, paper trading, isolated agent demonstrations, disconnected research automation, and
gross-profit results that omit firm-level costs may validate constituent capabilities, but they do
not by themselves establish Ouroboros.

Outer conformance, inner performance, and their connected real effects are three verification
perspectives, not three execution layers. The outer environment must demonstrate enforcement of
the relevant mandate and execution conditions. The inner operation must demonstrate self-directed
work and support its economic claims. Their connection must preserve the attributable path from
decision through actual effect, costs, obligations, and evidence to subsequent action. Separate
successes cannot substitute for that connection. Inner correctness and compliance still require
verification, and outer costs and failures still affect economic performance. Public code tests
alone do not establish which controls were effective in an actual deployment.

## 5. Continuing Product Validity

The minimum product proof establishes the existence and operational capability of Ouroboros, not
the permanence of its trading value. No finite profit, return ratio, experiment, or period of live
performance conclusively establishes continued improvement.

Five judgments must remain distinguishable throughout evaluation and operation:

| Judgment | Required distinction |
| --- | --- |
| Operating product existence | An agent-originated, authorized actual-capital trading loop has operated; this does not establish profitability. |
| The owner's net economic result | Contributions, withdrawals, timing, full costs, liabilities, and remaining net capital establish what happened to the owner; a gain does not identify its cause. |
| The contribution of AI operation | Evidence explains what agent-led discovery, allocation, execution, cost control, or adaptation added relative to relevant alternatives; firm profitability or market appreciation alone is insufficient. |
| Conditional earning ability | Evidence supports what the firm may be able to earn under stated conditions, scale, and time; neither one gain nor one loss settles repeatability. |
| The next allocation case | Current evidence, uncertainty, cumulative commitments, incremental effects, and realistic alternatives justify the proposed use of resources; past performance or willingness to contribute does not settle that case. |

Comparisons with the owner's realistic investment alternatives, explanations of what produced
performance, and tests of AI's contribution answer different questions. Explanations must consider
market exposure, risk, scale, chance, and selection; identifying those influences does not by
itself isolate the contribution of agent-led choices. One favorable index comparison does not
settle all three. Comparisons must make differences in risk, liquidity, horizon, costs, and human
burden visible under the mandate rather than choose an easy benchmark after observing results or
invent a favorable risk adjustment. This specification selects no particular index, return
formula, or risk-adjustment method. A simple strategy chosen and maintained by agents may serve
the purpose; distinctive model
prediction or greater complexity is not required. Do not remove consequences of agent-influenced
cash-flow decisions merely to improve reported performance, or attribute owner-directed
contributions to the agents' earning ability.

Claims of trading value must remain accountable to repeated firm-level net returns on actual
equity across changing market conditions, capital scales, and time. Favorable gross profit,
internal evaluation, or improvement in a proxy may not supersede the economic consequences
ultimately borne by the firm.

The case for continued capital must also address the owner's realistic alternatives under
the mandate. If the desired result is unsupported within permitted risk, expose the conflict and
propose alternatives without changing the mandate. Growth in profits withdrawn and net capital
remaining in operation cannot be indefinitely replaced by learning claims. Reduction, capital
return, or retirement remain available to the authorized decision-maker, accounting for existing
obligations.

Failure does not require the indiscriminate shutdown of Ouroboros. It requires that consequences
remain bounded and that the firm remain recoverable without losing control, truth, or identity.
Across interruption, restart, agent replacement, organizational change, or partial failure,
Ouroboros must preserve:

- sovereign control and delegated authority boundaries;
- actual equity, positions, obligations, and economic accountability; and
- the attributable chain of actions, evidence, judgments, learning, and succession.

Recovery may not erase losses, suppress adverse evidence, reinterpret uncertainty as success, or
grant authority that did not previously exist. Where these conditions cannot be re-established,
consequential action that depends on them may not resume. Authorized investigation and recovery
may continue without treating an unresolved state as restored control.

Temporary inactivity, interruption, or recovery does not extinguish the identity of Ouroboros
while these continuities remain intact and the firm retains the mandate and capability to return
to actual-capital live trading. Permanent withdrawal from such trading no longer satisfies the
Product Specification.

The live-trading condition does not require a trade when no justified opportunity exists or create
a right to continued capital. Waiting, reducing exposure, and managing remaining obligations can
be legitimate operation within the mandate. A single short-term loss does not require automatic
retirement, while learning claims cannot indefinitely exempt the firm from economic judgment.
