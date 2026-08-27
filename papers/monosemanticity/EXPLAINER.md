# Towards Monosemanticity, explained slowly

*Bricken, Templeton, Batson, Chen, Jermyn, Conerly, Turner, Anil, Denison, Askell, Lasenby,
Wu, Kravec, Schiefer, Maxwell, Joseph, Hatfield-Dodds, Tamkin, Nguyen, McLean, Burke, Hume,
Carter, Henighan, Olah — Anthropic, October 2023.*
[transformer-circuits.pub/2023/monosemantic-features](https://transformer-circuits.pub/2023/monosemantic-features/index.html)

---

## 0. Where to stand

This assumes one thing: you know how a transformer works. Residual stream, attention block, MLP
block, `x → W_in x → ReLU → W_out`, unembedding to logits. If you can picture the shape of the
activations flowing through a forward pass, you have everything you need. Nothing else is assumed —
superposition, dictionary learning, sparse autoencoders, compressed sensing all get built up here.

The paper is long and its structure hides its argument a little. The argument is actually one
sentence, and everything else is either motivation for it or evidence for it:

> **The individual neuron is the wrong unit of analysis for a language model, and you can find the
> right unit — a much larger, sparse, overcomplete set of directions in activation space — by
> training a small sparse autoencoder to reconstruct the MLP activations.**

Everything below is that sentence, unpacked.

Two ways to read this. Front to back, building the argument alongside its evidence — or start with
**§19, "The argument, told slowly"**, which tells the whole story once through in plain prose with no
figures or numbers, and then come back here for the detail. Neither order is wrong. §20 is the same
story again in six sentences, for afterwards.

---

## 1. The unit problem: why we can't just read neurons

Mechanistic interpretability has a simple plan. Break the network into components. Understand each
component. Understand how they compose. Read off the behaviour of the whole.

Step one — *pick the components* — turns out to be the hard step, and it fails in an unglamorous
way. The obvious component is the neuron: one dimension of the MLP hidden layer, one scalar per
token, the thing the architecture literally hands you. And the obvious way to understand a neuron is
to find what makes it fire.

When you do this, you find that most neurons fire on **mixtures of unrelated things**. In the
one-layer language model in this paper, a single neuron responds to academic citations, English
dialogue, HTTP requests, *and* Korean text. In the vision model Inception v1 there's a famous neuron
that fires on cat faces and on the fronts of cars. This is **polysemanticity**: one unit, many
meanings, and no principle connecting them.

Why is this fatal rather than merely annoying? Because of the curse of dimensionality. The whole
appeal of decomposition is that you can enumerate the pieces, understand each in isolation, and
compose upward. A component that means four unrelated things cannot be understood in isolation — you
can never say "this neuron fired, therefore X", only "this neuron fired, therefore X or Y or Z or W,
and which one depends on the other 511 neurons". You have gained nothing over reading the raw
activation vector.

Note also what you *can't* do about this. In earlier work (*A Mathematical Framework for Transformer
Circuits*) the authors sidestepped the problem by studying attention-only transformers, where the
computation can be rewritten in a form that doesn't reference hidden activations at all. That trick
dies the moment you add an MLP with a ReLU. A one-layer transformer with one MLP block is, in their
phrase, *the simplest language model we profoundly don't understand* — and it is exactly because you
cannot avoid decomposing the MLP activation vector.

So: the MLP activations must be decomposed, and the neuron basis is not the decomposition.

---

## 2. Superposition: why neurons look like that

There's a hypothesis that explains polysemanticity, and it comes in two parts.

### 2.1 Features are directions, not neurons

The **linear representation hypothesis**: the meaningful units in a network are *directions* in
activation space, not basis dimensions. Sometimes a meaningful direction happens to line up with a
basis dimension, and then you get an interpretable neuron and everyone is happy. There is no reason
it should generally line up. Word2vec's `king − man + woman ≈ queen` is the folk version of this
claim; interpretable neurons in CNNs and RNNs are the happy special case.

Call these meaningful directions **features**. A feature is a unit vector `d_i` in the activation
space, plus a scalar `f_i(x) ≥ 0` saying how strongly it's present in a given activation vector `x`.

### 2.2 There are more features than neurons

The **superposition hypothesis**: a network wants to represent more features than it has dimensions,
and it does so by giving each feature its own direction in a space too small to hold them all
orthogonally.

This sounds impossible and isn't, for two reasons worth sitting with:

**High-dimensional spaces have room for many almost-orthogonal directions.** In `n` dimensions you
get exactly `n` mutually orthogonal vectors, but *exponentially many* vectors that are pairwise
within a few degrees of orthogonal. If you tolerate a little interference, the capacity is enormous.

**Sparsity makes the interference survivable.** If features are rare — only a handful active on any
given token — then on most inputs the non-orthogonal directions simply aren't both switched on, so
they don't collide. The interference becomes noise you can push through a ReLU threshold.

Put those together and you get the picture: a 512-dimensional MLP layer running a *noisy simulation
of a much larger, much sparser network*. The features form an **overcomplete basis** — more
directions than dimensions.

And now polysemanticity is explained. A neuron is one basis dimension. If there are 10,000 feature
directions scattered across 512 dimensions, any single dimension has non-zero overlap with hundreds
of them. Reading a neuron means reading a projection of hundreds of features at once. Cat faces and
car fronts, Korean and HTTP requests — these are not a meaning, they're a *cross-section*.

> This is a good moment to notice something the paper will exploit later. If languages are roughly
> mutually exclusive in text, they are ideal candidates to pack into superposition together — they
> will never both be on. And indeed, the neuron most correlated with the Arabic feature and the
> neuron most correlated with the Hebrew feature turn out to be *the same neuron*: a "various
> non-English languages" neuron. That's not a coincidence; it's the superposition strategy showing
> through.

---

## 3. Writing the hypothesis down as an equation

Here is the whole formal content of the setup. Let `x^j ∈ R^512` be the MLP activation vector (after
the ReLU) at token `j`. The hypothesis is:

```
x^j  ≈  b  +  Σ_i  f_i(x^j) · d_i
```

- `d_i` — a unit vector in `R^512`, the **direction** of feature `i`. There are `m` of them, and
  crucially **`m` is larger than 512**.
- `f_i(x^j) ≥ 0` — the **activation** of feature `i` on this token. Most of these are exactly zero;
  that's the sparsity.
- `b` — a bias.

Stare at this and notice that it is not a new idea at all. It's a linear matrix factorization: stack
the `d_i` as the columns of a matrix `W_d` and you have `x ≈ W_d f + b`. This is precisely the
classic problem of **sparse dictionary learning** — find a dictionary of atoms such that every data
point is a sparse combination of a few atoms. Superposition, stated formally, *is* a dictionary
learning problem. That's the pivot the entire paper turns on.

### 3.1 The hard part is the inner problem

Given the dictionary `W_d`, how do you compute `f` for a new `x`? You're solving `x = W_d f` for `f`,
where `W_d` is `512 × m` with `m ≫ 512`. You are asked to recover a high-dimensional vector from a
low-dimensional projection. **There are infinitely many solutions.**

The only thing that makes it well-posed is the sparsity constraint: among all the `f` that explain
`x`, find the one with the fewest non-zeros. This is **compressed sensing**, and in its exact form
it's NP-hard. High-dimensional sparse structure can be *stored* in a low-dimensional space; getting
it back out is genuinely difficult.

The authors flag this as the reason the whole enterprise is surprising: *"it's actually kind of
miraculous that this is possible at all."* Making a decomposition overcomplete sounds like a small
change and is in fact the entire difficulty.

---

## 4. A detour the paper had to close first: why not build a model without superposition?

Before reaching for dictionary learning, there's an obvious alternative that has to be killed off,
and the argument that kills it is one of the more interesting things in the paper. It's easy to skim
past. Don't.

The alternative: if superposition is what makes neurons polysemantic, *train models that can't do
superposition*. Push activation sparsity hard during training — in the limit, force one-hot
activations. Accept a hit on loss in exchange for a model you can read.

The team tried this, seriously, and concluded it is **fundamentally non-viable**. Not too expensive.
Non-viable. Because they found models with no superposition at all that *still* had polysemantic
neurons.

Here's the toy case that shows why. One neuron, binary — it fires or it doesn't. Four
mutually-exclusive, equally likely features A/B/C/D in the data; each one, if you knew it was
present, tells you the next token is the matching token A/B/C/D. Cross-entropy loss.

**Strategy 1 — monosemantic.** The neuron fires only on feature A and predicts token A perfectly.
When it doesn't fire (3/4 of the time), the model knows only "not A" and predicts uniformly over
B/C/D.

```
loss = (3/4) · ln 3  ≈  0.82
```

**Strategy 2 — polysemantic.** The neuron fires on A *and* B, predicting a 50/50 mix over {A, B}.
When it doesn't fire, predict a 50/50 mix over {C, D}.

```
loss = ln 2  ≈  0.69
```

The polysemantic strategy wins, and it wins **with a single neuron, where superposition is not even
possible**. The model isn't cramming; it's ordinary information-theoretic behaviour under
cross-entropy. Being half-right about two things beats being fully right about one thing and
ignorant of three.

This generalises: push activation sparsity to its limit and only one neuron fires at a time — and
that one neuron still has this incentive. So:

> **Models trained on cross-entropy will prefer polysemantic representations, even when
> architectural constraints make superposition impossible.**

Notably this is *specific to the loss function*. Under mean squared error the two strategies can tie,
and for some importance curves MSE actively prefers the monosemantic solution. But language models
are trained with cross-entropy, so architectural fixes are out.

And here is the elegant consequence, which is easy to miss: **the sparse autoencoder is trained with
MSE.** That's not incidental. It means the decomposition itself doesn't inherit the incentive to be
polysemantic — otherwise you'd get superposition all the way down, a dictionary that is itself
compressed and unreadable.

---

## 5. The instrument: a sparse autoencoder

Given that we need dictionary learning and that classical methods exist, why build a new one?

Two reasons, and the second is the interesting one.

**Scale.** Classical dictionary learning (K-SVD, MOD, matching pursuit) involves iterative or greedy
inner loops that don't ride a GPU comfortably to billions of data points. They trained on **8 billion
activation vectors**. Nothing iterative was going to get there.

**Not being too strong.** Exact compressed sensing is NP-hard. The transformer is *certainly not*
doing anything NP-hard when it reads its own activations downstream. So a sufficiently clever
dictionary learning algorithm could recover structure from the activations *that the model itself
cannot use* — and you'd be interpreting a fiction. A sparse autoencoder is architecturally a
one-hidden-layer MLP, which is roughly what the rest of the transformer is; it is a plausible upper
bound on what the model can extract from its own activations. **Weakness is a feature.**

### 5.1 The architecture, exactly

```
x̄  =  x − b_d                      # subtract a learned "pre-encoder" bias
f  =  ReLU(W_e x̄ + b_e)            # encode: R^512 → R^m,  m ≫ 512
x̂  =  W_d f + b_d                  # decode: back to R^512

L  =  (1/|X|) Σ_x ‖x − x̂‖²₂  +  λ‖f‖₁
```

Read the parts against the equation from §3:

- The **columns of `W_d`** are the feature directions `d_i`, constrained to unit norm.
- The **rows of `W_e`** are feature detectors; `f_i` is the feature activation.
- The ReLU is what makes features one-sided and gives exact zeros.
- The L1 penalty is the sparsity pressure — the tractable relaxation of "minimise the number of
  non-zeros", the standard compressed-sensing move.

Two constraints deserve a note because they look arbitrary and aren't:

*Unit-norm decoder columns.* Without this, the L1 penalty is trivially gameable: halve every `f_i`,
double every `‖d_i‖`, same reconstruction, half the penalty. Fixing the norms makes `‖f‖₁` mean
something.

*The pre-encoder bias `b_d`, tied to the decoder bias.* Equivalent to subtracting a fixed offset from
all activations before doing anything. It's initialised to the geometric median of the dataset. In
toy models with a known ground truth, the autoencoder failed to recover the right answer without it.

### 5.2 Encoder and decoder are not tied

Standard practice for a one-hidden-layer autoencoder is to set `W_e = W_dᵀ`. They deliberately
don't, and the reason is a genuinely nice piece of insight:

> The **decoder** is trying to *represent* the feature — it wants `d_i` to be the true feature
> direction. The **encoder** is trying to *detect* the feature — it wants the projection direction
> that best separates this feature from other features that are geometrically nearby and would
> otherwise leak into it.

These are different jobs. Concretely: the three base64 features discussed later have nearly parallel
dictionary vectors, but their encoder vectors are tilted away from each other, precisely to avoid
crosstalk. The right way to see the encoder is as *a linear, amortised approximation to a multi-step
non-linear sparse coding algorithm* — one matrix multiply standing in for an iterative solver. Neel
Nanda's replication measured the median cosine similarity between a feature's encoder and decoder
vectors at only 0.5, which is empirical confirmation they're doing different things.

### 5.3 Dead neurons, and resampling

Over training, many autoencoder units stop firing entirely and never recover — the ReLU gate closes
and no gradient flows back to reopen it. Dead units are wasted dictionary capacity.

The fix is blunt and effective. At steps 25k / 50k / 75k / 100k:

1. Find units that haven't fired at all in the previous 12,500 steps.
2. Evaluate the current autoencoder's loss on 819,200 random inputs.
3. Sample an input with probability proportional to the **square of the loss** on it — i.e. pick the
   data points the dictionary is currently worst at.
4. Set the dead unit's dictionary vector to that (normalised) input.
5. Set its encoder vector to the same direction, but scaled to **0.2 ×** the average encoder norm of
   live units, with encoder bias zero.
6. Reset the Adam moments for everything touched.

Step 5 is the careful bit: the reborn unit starts weak, so it only fires on inputs very close to its
seed, and doesn't disrupt everything else while it finds its footing. The whole procedure is "spend
your dead capacity on whatever you currently explain worst."

### 5.4 Training details that turned out to matter

- **8 billion activation vectors**, sampled without replacement (never repeating data mattered),
  batch size 8192, 1 million steps. Activations gathered from 40 million Pile contexts, 250 tokens
  sampled per context, then shuffled so a batch spans many contexts.
- **More data made features subjectively sharper.** Scale mattered here in the ordinary way.
- **Lower learning rates + more steps** → lower loss and more real features. Annealing didn't help.
- **Adam vs. the unit-norm constraint.** Naively renormalising `W_d`'s columns after each step throws
  away the parallel component of the gradient *after* Adam has already used it to update its moment
  estimates, so Adam is working from a gradient that isn't the true one. Projecting out the parallel
  component *before* the step is the principled fix, and it measurably helps.

### 5.5 The part where they admit they can't tell if it's working

This is the most honest section of the paper and worth reading in the original. In normal ML you
have a test loss. Here, the loss is a *choice* — you can trade reconstruction against sparsity by
turning λ, and there's no principled setting. Lower λ, better reconstruction, worse
interpretability. Higher λ, sparser, but features start collapsing together.

They looked for an information-theoretic criterion (minimise total information of dictionary + data)
and it **didn't correlate with interpretability**. Runs with average L0 in the hundreds could score
better than sparse ones.

What they use instead is a bundle of proxies:

- **Manual inspection.** Still the metric they trust most.
- **Feature density histograms.** For each feature, the fraction of tokens it fires on; plot the
  distribution on a log scale. Two numbers to watch: how many live features you recovered, and how
  *rare* the rarest recovered feature is.
- **L0 norm** — average number of non-zero features per token. They target **under 10–20**, and
  specifically distrust solutions where L0 is a meaningful fraction of 512.
- **Reconstructed NLL** — splice the autoencoder's output back in place of the real MLP activations
  and measure how much loss you lost.
- **Toy models with known ground truth**, which is how they made early progress at all.

The density histogram deserves a note because it exposes a real artifact. The distribution is
**bimodal**: a "high density cluster" around 10⁻⁵ and an **"ultralow density cluster"** around 10⁻⁷.
Almost every feature in the high density cluster is interpretable; almost none in the ultralow
cluster are. Training longer kills more of them. They're an artifact of the training procedure, not
a fact about the transformer, and they get excluded from analysis. (Nanda's replication found the
same cluster, found that its members are nearly all *the same direction*, couldn't interpret that
direction, and found that training an autoencoder to be orthogonal to it just produces a new
ultralow cluster along a new direction. Still unresolved.)

> **Takeaway to carry forward:** the sparse autoencoder is a small, deliberately weak, MSE-trained
> MLP whose hidden units are the candidate features. Everything else is engineering to make it find
> good ones.

---

## 6. The specimen: one layer, and why

The model being decomposed:

| | |
|---|---|
| Layers | 1 attention block + 1 MLP block (ReLU) |
| Residual stream | 128 |
| MLP hidden | 512 |
| Data | The Pile, **100 billion tokens** (heavily overtrained) |

And the autoencoders trained on its MLP activations, from 512 features (1×) up to 131,072 (256×).
The one the paper mostly discusses is **A/1: 4,096 features, an 8× expansion.**

Naming convention, since it's used constantly: `A/1/3450` = model A, dictionary run 1, feature 3450.
`A/neurons/489` = neuron 489 of model A. Model **B** is the same architecture and data with a
different random seed, and exists so universality can be tested.

Three reasons the one-layer model is the right testbed:

1. **It's small enough to maybe finish.** Fewer "true features" to find, so a modest dictionary might
   actually cover them, and small dictionaries are cheap enough to sweep hyperparameters on.
2. **It can be massively overtrained cheaply** — 100B tokens on a tiny model. The bet is that heavy
   overtraining produces *cleaner* superposition, features that have settled into stable directions.
3. **The logits are approximately linear in the feature activations.** This is the important one.

Unpack (3), because it's what makes the evidence in §8 possible. In a one-layer model the MLP output
goes straight to the residual stream and then to the unembedding. So the effect of a feature on the
logits is very nearly a fixed vector you can compute in closed form:

```
logit weights of feature i  =  d_i · W_down · π · L · W_unembed
```

where `π` removes the mean and `L` is a diagonal approximation of the layernorm scaling. **One
matrix product and you have this feature's opinion about every token in the vocabulary.** No
patching, no sampling. That's a luxury a deep model doesn't give you, and the paper leans on it
constantly.

There's a real cost to this choice, and the paper names it: the linear structure makes it *more*
likely that features are linear here, so the result may generalise less well to deep models. The
mitigating evidence is that others (Cunningham, Smith) found interpretable linear features in
multi-layer models with the same method.

---

## 7. What "this feature is real" has to mean

Before the evidence, the standard of evidence. For each feature they investigate, five claims:

1. **Specificity** — when the feature is on, the hypothesised context is usually present.
2. **Sensitivity** — when the context is present, the feature is usually on.
3. **Downstream effect** — the feature causes appropriate behaviour in the rest of the model.
4. **Not a neuron** — it isn't just a nice neuron dictionary learning happened to hand back.
5. **Universality** — a matching feature appears in an independently trained model.

Claim 3 is doing more work than it looks. Here is the argument, and it's the load-bearing epistemics
of the whole paper:

> The autoencoder is trained **only** on MLP activations. It never sees `W_down`, never sees the
> unembedding, never sees the loss, never sees a single output token. So in principle the features
> it finds could be structure in the *data distribution* that survived the first half of the model —
> real patterns, but nothing to do with the model's computation.
>
> The **downstream effects were never an input to the fitting procedure.** So if a feature you found
> by reconstructing activations turns out to also have a coherent, matching effect on the output
> logits — ablate it and exactly the right predictions get worse; clamp it high and the model
> generates exactly the right kind of text — that agreement is *free evidence*. It cannot be
> overfitting, because the thing being predicted was never fit.

That's the shape of the whole existence proof: **fit on the input side, validate on the output side.**

### 7.1 Computational proxies

To test specificity and sensitivity at scale you need a mechanical judge, not a human reading
examples. So for four contexts they build a **computational proxy**: a score estimating

```
log( P(s | context) / P(s) )
```

— a log-likelihood ratio, "how much more likely is this string if we're in the context than under the
data distribution generally." Log-likelihood specifically, on the reasoning that features act
linearly on logits and so are incentivised to track log-likelihoods.

The pieces:

- `P(s)` — product of unigram token probabilities.
- `P(s | base64)` — model base64 as uniform over `[a-zA-Z0-9+/]`, so 1/64 per character, and 10⁻¹⁰
  for anything else.
- `P(s | DNA)` — uniform over `[ATCG]`, 1/4 each.
- `P(s | Arabic)` — via Bayes: `P(Arabic|s)·P(s)/P(Arabic)`, exploiting the fact that Arabic script
  lives in known Unicode blocks. All-Arabic string → `P(Arabic|s) = 1`; any non-Arabic character →
  10⁻¹⁰.

One refinement: since a feature's activation on a token can depend on what came before (the Arabic
feature might build confidence over a long Arabic string), they maximise the score over prefixes
ending at the token in question.

**These proxies are crude on purpose, and their failures matter.** Whitespace and punctuation are
shared across scripts and count as "not Arabic". Hexadecimal strings look like base64 to the base64
proxy. DNA written with spaces between codons doesn't parse as DNA. Every one of these produces
apparent disagreement between feature and proxy, and in most cases the *feature* turns out to be
right. Which is itself a finding — the model is a better judge of these contexts than the
hand-written rule is.

The four features chosen (Arabic, DNA, base64, Hebrew) are openly **cherry-picked for being easy to
write a proxy for**. This section is an existence proof, not a survey. The survey is §10.

---

## 8. The Arabic feature, all the way through

`A/1/3450`. It fires on text in Arabic script — Arabic, Farsi, Urdu. Let's do all five claims
properly, because the pattern repeats for every other feature in the paper.

### 8.1 Specificity

Take 40 million tokens. Score each one with the Arabic proxy. Plot the histogram of the feature's
activations, coloured by whether the proxy says "Arabic".

- Arabic script is **0.13% of all training tokens**.
- It is **81% of the tokens where this feature is active**.
- Broken down by strength: **25%** where the feature is barely on → **98%** where activation
  exceeds 5.

So the feature is highly specific at the top of its range and gets muddier at the bottom. Three
candidate explanations, offered without picking one:

1. **The proxy is imperfect.** It has false negatives on shared characters — there's a newline the
   feature fires on that the proxy scores as non-Arabic because a newline isn't in the Arabic
   Unicode block.
2. **The model is imperfect but calibrated.** If activation encodes *confidence*, weak activations
   should sometimes be wrong. This is a very weak one-layer model, and Arabic characters are often
   split across multiple tokens, which makes the job genuinely harder.
3. **The autoencoder is imperfect.** If there are more true features than dictionary slots, the
   unrecovered ones show up as low-level noise spread across many learned features.

There's a tool for making the "does the low end matter?" question precise: the **expected value
plot**. Instead of counting tokens, weight each token by the feature's activation on it — so the
histogram shows where the feature's *magnitude* lives, not where its firings live. Almost all the
mass sits in Arabic script. The low-activation mud is numerous but contributes little.

This matters because in this model, activation size maps directly to influence: features act
linearly on the logits, so a 10× larger activation is a 10× larger push. Getting the top of the
spectrum right is what counts.

### 8.2 Sensitivity

Now the other direction: does it fire on *all* Arabic? No. It conspicuously misses the prefix "ال"
(*al-*, the Arabic definite article) — five times in one sample of random examples.

But in exactly those positions, **another** Arabic feature fires: `A/1/3134`. And there are more —
`A/1/1466`, `A/1/3399`. There's a division of labour by tokenisation, too: Arabic characters often
split into two tokens (ث = U+062B tokenises as `\xd8` then `\xab`), and `A/1/3450` fires on the
*last* token of a character while `A/1/3399` fires on the *first*.

So the honest statement is: no single feature covers Arabic, a small team of them does. Over 40M
tokens, `A/1/3450` alone correlates **0.74** with the thresholded proxy — a joint measure of
sensitivity and specificity that respects magnitude. Substantial, and clearly not the whole story.

Hold onto this observation. It's the first sighting of **feature splitting** (§13), which is the
paper's second big idea.

### 8.3 Downstream effects — three independent tests

**(a) Logit weights.** Compute `d_i · W_down · π · L · W_unembed` and histogram it over the
vocabulary. The distribution is **bimodal**: a big mode at zero, and a small mode far to the right.
The right mode is Arabic characters — and specifically `\xd8` and `\xd9`, which are the *first bytes*
of most UTF-8 Arabic codepoints. The feature has learned to bet on the byte-level machinery of the
script it detects.

**(b) Causal ablation.** Run a real context to the MLP, encode into features, **set this feature's
activation to zero across the whole context**, and finish the forward pass. Record how each token's
predicted log-likelihood changed. Result: ablating it *hurts* the prediction of every Arabic token,
and *helps* the prediction of a period — the one character shared with other scripts. The effect
scales with activation strength: halve the activation, roughly halve the impact.

**(c) Pinned feature sampling.** Take a prompt with an obvious continuation —
`1,2,3,4,5,6,7,8,9,10` — then clamp this feature to its maximum observed value and sample. **The
model produces Arabic text.**

Three different instruments, all agreeing, none of them an input to the training. This is what claim
3 was for.

### 8.4 It is not a neuron

The obvious deflationary story: dictionary learning found an already-monosemantic neuron and
relabelled it. Ruled out four ways:

- **Search the neurons.** Look at the top 20 dataset examples for every neuron; only one neuron has
  *any* Arabic in its top 20, and only a single example (eighteen of the rest are English, one
  Cyrillic).
- **Look at the feature in the neuron basis.** `d_i` expressed over the 512 neurons: **the three
  largest coefficients are all negative**, and **27 neurons have coefficients of magnitude ≥ 0.1**.
  This direction is thoroughly distributed, and partly *anti*-aligned with the neurons that matter
  most to it.
- **Find the most correlated neuron.** `A/neurons/489`, and it responds to a *mixture of non-English
  languages* — Russian, Korean, others, with Arabic a thin sliver. Its logit weights say the same
  thing: mostly Russian and Korean tokens on top, with a thin sliver of Arabic tokens weighted very
  slightly positive, some negative.
- **Scatter the two against each other.** Feature activation on one axis, neuron activation on the
  other. The feature axis cleanly separates Arabic from everything else. The neuron axis doesn't.

That last framing is the cleanest way to say it. Both views see the same data; only one of them has
an axis along which Arabic is a distinct thing.

> **The Arabic feature is effectively invisible if you analyse this model in terms of neurons.**
> Not faint. Invisible.

### 8.5 Universality

Take model **B** — same architecture, same data, different random seed — and its dictionary run
`B/1`. Find the feature whose activations across 40,960,000 tokens correlate most with `A/1/3450`.

It's `B/1/1334`, correlation **0.91**. Same activation pattern, same bimodal logit weights, same
ablation behaviour. If anything it's a *cleaner* feature — more specific in the 0–1 range.

One wrinkle worth understanding, because it recurs. The **activation** correlation is 0.91, but the
**logit weight** correlation is only **0.23**. Why the gap? Scatter the two features' logit weights
against each other and you see a tight cluster of Arabic tokens agreeing in the top right — and a
large diffuse blob in the middle, near-uncorrelated noise, that dominates the correlation statistic.

The proposed reading: that central blob is **interference weights**. The model would *prefer* those
weights to be zero, but the feature's direction isn't perfectly orthogonal to everything else, so it
inherits small arbitrary opinions about tokens it doesn't care about. Those opinions are arbitrary,
hence different across seeds, hence uncorrelated. **The shared outlier mode is the signal; the
central blob is superposition's exhaust.**

Once you can see that, you see it everywhere in the paper's scatter plots.

---

## 9. Three more features, faster

Same five-claim structure, different lessons.

### DNA — `A/1/2937`

Fires on long uppercase `[ATCG]` runs. Binarised proxy correlation **0.80**. Unlike Arabic, this is
the *only* feature for the context, so it has to cover the whole job itself.

The interesting part is where feature and proxy disagree, because **the feature is nearly always
right**:

- `TGG AGT` — space between codons, proxy fails, feature fires. Still DNA.
- `5'-TCT` — the feature fires on the `'-` itself, *before* any nucleotides, because what follows a
  `5'-` prefix is going to be DNA. Ablation confirms it: turning the feature off hurts the prediction
  of the sequence that follows. **The feature is predicting DNA, not just detecting it.**

Only two genuine disagreements in the whole analysis, and one is the feature being a token late at
the start of a sequence. Logit weights are exactly what you'd hope: `AGT`, `GCC`, and friends. The
most-correlated neuron has DNA as a tiny sliver of its examples; the neuron with the largest
coefficient in the feature's vector has *no* DNA in its top examples at all. Universality: `B/1/3680`
at **0.92**.

### base64 — `A/1/2357`

Fires on base64 strings. Chosen partly because a base64 *neuron* had shown up in earlier SoLU work,
hinting at deep universality.

**Proxy correlation is only 0.38 — and that's the proxy's fault.** Hexadecimal (`[0-9A-F]`) also
scores high under a "random characters unlike normal text" model, but hex is handled by its own
dedicated feature, `A/1/3817`. The proxy is too broad, not the feature too vague.

The logit weights show a **more continuous** transition from non-base64 to base64 tokens than Arabic
did, and there's a good reason. "Is this token Arabic?" is near-binary. "Is this token base64?" is a
matter of degree — `fr` is a base64 token *and* a common French abbreviation, so the model is right
to be cautious about upweighting it. Any Latin-alphabet token has some base64 probability. **The
shape of the logit distribution reflects the shape of the underlying concept.**

Most correlated neuron: `A/neurons/470`, correlation 0.18, which does respond to base64 but also to
code, HTML labels, URL fragments — and whose logit weights care mainly about filename endings.
Universality: `B/1/2165` at **0.85**.

### Hebrew — `A/1/416`

Proxy correlation **0.55**, with some of the shortfall explained by a companion feature `A/1/1016`
that fires on `\xd7` (the first byte of most Hebrew codepoints) and predicts the byte that completes
the character. Logit weights have the same second mode, containing Hebrew characters and partial
Unicode bytes.

The most correlated neuron is `A/neurons/489` at correlation **0.1** — *the same "various non-English
languages" neuron* that was most correlated with the Arabic feature. And a search across all neurons
for any whose top examples contain the Hebrew Unicode block turns up **nothing**.

This is the sharpest single result in the section. Two distinct, causally verified, universal
features — Arabic and Hebrew — both project weakly onto one shared neuron, and neither is visible in
the neuron basis. That's what superposition looks like from the inside. Universality: `B/1/1901` at
**0.92**.

---

## 10. Is the typical feature like this?

Four cherry-picked features prove features *can* be clean. §4 of the paper asks whether the other
4,000 are.

First, some housekeeping. Of A/1's 4,096 features: **168 are dead** (never fire on 100 million
examples) and **292 are ultralow density** (fire on fewer than 1 in a million tokens, and behave
strangely). Both groups are excluded — the ultralow cluster is an autoencoder artifact, per §5.5.

### 10.1 Human scoring

A blinded annotator scored features and neurons on a rubric out of 14: confidence in your
interpretation (0–3), consistency of high-activation tokens with it (0–5), consistency of the
positive logit effects with it (0–3), whether inconsistent logit effects at least separated by effect
size (0–1), and specificity (0–3).

The methodological care here matters. A known way to fool yourself is to look only at **top dataset
examples** — many polysemantic neurons look monosemantic if you only read their top 20 firings, and
reveal themselves further down. So the activation range is divided into **11 evenly spaced
intervals** from zero to max, examples are sampled uniformly across intervals, and each interval is
scored separately against the overall hypothesis.

412 intervals across 162 features and neurons:

- **Median neuron: 0.** Zero means the annotator *could not form a hypothesis at all* about what the
  neuron does.
- **Median feature interval: 12.** Confident, specific, consistent, and corroborated by the logit
  weights.

### 10.2 Automated interpretability

Following Bills et al.: show Claude examples of where a feature fires, have it write an explanation,
then have a fresh copy use only that explanation to predict activations on unseen tokens. Score by
Spearman correlation between predicted and true. No leakage — the predicting model never sees a true
activation.

Again, sampled across all activation intervals rather than only the top, which is a harder test than
the original setup. 60 examples of nine tokens each per feature, 540 predictions. **Features score
significantly better than neurons.**

### 10.3 Automated interpretability on the *logit weights*

The cleverest of the three, because it tests the cross-validation directly. Take the explanation
generated from *activations*, then ask a model: given this explanation, would this feature predict
this token as likely to come next? Score against a 50/50 mix of real top-positive-logit tokens and
random tokens.

```
chance    50%
neurons   58%
features  74%
```

An explanation derived purely from **when a feature fires** predicts **what it makes more likely** at
74%. Those are two different halves of the model, connected only by the hypothesis. The gap between
74 and 58 is the paper's claim, quantified.

### 10.4 Where interpretability lives on the spectrum

Scoring per activation interval reveals a consistent pattern. Many features are consistent across
their whole range. Others are consistent across the **top ~60%** and then degrade toward zero.

A candidate explanation, offered honestly: if a learned feature sits at a slight angle to the "true"
feature, the discrepancy would show up exactly there — small activations are where a slightly-wrong
direction picks up things it shouldn't.

Two caveats they raise themselves: most activations are small, so most *activations* fall in the less
interpretable intervals (though most *magnitude* doesn't — the expected value plot again); and
features were sampled uniformly rather than by importance, though spot checks suggest important
features are *more* interpretable, not less.

---

## 11. How much of the model is actually explained?

The question the paper is least able to answer, and says so.

The measurable version: splice the autoencoder in. Replace the real MLP activations with the
reconstruction and measure the loss increase, normalised against the loss increase from zero-ablating
the MLP entirely.

```
A/1  (4,096 features, 8×)     →  79%    of the MLP's loss contribution recovered
A/5  (131,072 features, 256×) →  94.5%
```

Now the grains of salt, all of which the paper supplies:

- **Fraction-of-loss may be the wrong frame.** Expect a long tail: each additional percent of loss
  needs disproportionately more features.
- **The baseline is generous.** Zero-ablating the MLP is a very bad model, so dividing by it flatters
  the number. Ad-hoc experiments showed similar percentages can be reached just by training a
  transformer from scratch with a much smaller MLP.
- **Not all features are clean.** Some polysemanticity plausibly hides in low activations.

But the individual features from §8–9 do something the aggregate number can't: they show that
specific interpretable features are *used* by the model in interpretable ways. Ablate them and the
right predictions get worse. Clamp them and the right text comes out. So the 79% is measuring
something real even if the exact figure is soft.

### 11.1 The control that matters most: a randomly-weighted transformer

Here's the sharpest threat to the whole result. Activations reflect two things: the data
distribution, and what the model does to it. Dictionary learning on activations sees both. Maybe the
features are just correlations in the Pile, projected into a 512-dimensional space, with the model
contributing nothing?

The control: **shuffle the entries within each of the trained transformer's weight matrices** — so
every weight distribution is preserved exactly and only the structure is destroyed — and run the
whole pipeline on that.

Result: you get **many single-token features** ("span", "file", ".", "nature") and some features
firing on arbitrary subsets of recognisable contexts like LaTeX or code. But the non-single-token
features **cannot be interpreted**. No Arabic feature, no DNA feature, no
base64-that-decodes-to-ASCII feature.

There's a second, subtler finding here that's easy to misread. On the *automated* interpretability
metric, randomised-transformer features score a higher median than A/1 features. Alarming until you
split the distribution: the randomised model produces a large cluster of extremely pure
**single-token** features, which are trivially easy for an LLM to explain and score. Strip those out
and the remaining randomised features score like **polysemantic neurons**, while A/1's features score
well above both. And on logit-weight interpretability the randomised model sits at chance, by
construction.

So: the data contributes single-token structure. **Everything else comes from training.**

---

## 12. What kinds of features exist

Now the part of the paper that's about what we *learn*, rather than whether the method works. The
authors call this phenomenology.

**Context features.** The whole context is in a mode: DNA, base64, Arabic. These fire and stay on.

**Token-in-context features.** A specific token, *but only in a specific context*. `the` in
mathematical writing (`A/0/341`). `<` in HTML (`A/0/20`). These turn out to be everywhere — in run
A/4 there are **over a hundred distinct features that primarily respond to the token "the"** in
different contexts. That was not expected, and §16 wrestles with it.

There's a nice theoretical reason to expect both. Attention heads essentially compute three-point
functions — two inputs and an output. MLP layers are the natural place to implement **N-token
conjunctions**, and a context feature is the extreme case of a conjunction over many tokens.

**Trigram-ish features.** A feature that predicts `19` after `COVID-`. In principle attention alone
could do this; in practice the model recruits the MLP too.

**Features as actions, not just detectors.** This reframing is worth internalising. Every feature in
a one-layer model has two equally valid readings:

> **Input view:** this feature fires when the context is base64.
> **Action view:** this feature acts to increase the probability of base64 tokens.

They're the same vector read from two sides. And the action view often explains the input view's
oddities. `A/0/341` looks like a "*the* in mathematics" feature, which is a strange thing to be —
until you notice its real job is *predicting noun phrases in mathematical writing* (`the
denominator`, `the remainder`, `the theorem`). Under that reading it makes total sense that it also
fires on `special` and `this`, which are also followed by noun phrases. **The feature isn't about the
token it fires on; it's about what comes next.**

---

## 13. Feature splitting

If superposition is the paper's inherited idea, feature splitting is its new one. It reframes what
dictionary learning even is.

### 13.1 The observation

Features come in **clusters**. Multiple Arabic features. Multiple base64 features. And as you widen
the dictionary — 512 → 4,096 → 16,384 — the number of features devoted to a given context grows:
base64 goes from **1 → 3 → many more**.

Run UMAP on the feature directions from A/0, A/1 and A/2 together and the clusters are geometric, not
just semantic: **conceptually similar features have small angles between their dictionary vectors.**
The qualitative grouping is real structure in the dictionary.

### 13.2 The interpretation

> Suppose there's some idealised set of "true features" that dictionary learning would return with an
> unlimited budget. These true features come in tight clusters of near-parallel directions. When your
> dictionary is too small, dictionary learning doesn't *drop* features — it returns features that
> **cover approximately the same territory** as a cluster, at the price of being less specific.

Widen the dictionary and the coarse feature *splits* into its constituents. So:

> **Dictionary size is a resolution knob.** A/0 is a low-resolution view of the same object A/2 views
> at high resolution. Neither is wrong.

Why should conceptually similar features be geometrically similar? Because of the action view (§12).
Features that predict similar next-tokens must produce similar effects downstream, and therefore
similar activation patterns in the neurons. If several features fire on periods in slightly different
contexts, they'll all want to upweight "space then capital letter" — so their directions converge.

This is a *correction* to the earlier Toy Models picture, where features repelled each other into a
roughly even spread. Real models have **denser and more structured superposition** than the toy
models predicted, because real features are both correlated in *when they fire* and similar in *what
they do*. The toy models only ever modelled the first.

### 13.3 Why this matters practically

- **Getting "the right number of features" is less critical than it sounds.** You fail *gracefully*:
  too few features gives you a blurry but not wrong picture.
- **Small dictionaries are useful as summaries** — potentially very important for large models, where
  the full feature set may be unmanageably large.
- **It suggests a working method**: use a coarse dictionary to find the *category* of behaviour, then
  a fine one to investigate its structure.

### 13.4 The two "bugs" that turned out to be splitting

**Bug 1: single-token features.** In small dictionaries there are many high-magnitude features that
fire on exactly one token, every time it appears — e.g. `P` at the start of a word. This is bizarre:
the model could get that effect from bigram statistics alone, so why spend MLP capacity?

Answer: it hasn't learned a `P` feature. It's learned **many `P`-in-different-contexts features**,
with different downstream effects, and a coarse dictionary can't tell them apart so it returns their
average. Widen the dictionary and a whole zoo of `P` features appears.

**Bug 2: three features for base64.** In A/0 there's exactly one base64 feature, `A/0/45`, firing on
everything base64. In A/1 it has split into three whose activations jointly cover A/0/45's. What are
they?

- `A/1/2357` — fires preferentially on **letters** in base64.
- `A/1/2364` — fires preferentially on **digits** in base64.

Their logit weights are nearly identical with one systematic difference: **the digit feature assigns
much lower weight to predicting digits.** Which looks arbitrary until you think about BPE. If a digit
were followed by another digit, the tokeniser would have merged them: `[Bq][8][9][mp]` never occurs,
because it would be tokenised `[Bq][89][mp]`. **So a single-digit token is genuine evidence that the
next token is not a digit** — even in a uniformly random base64 string. The model has learned a fact
about its own tokeniser and built a feature around it.

- `A/1/1544` — the third one, with no obvious rule. Until you notice it responds to **base64 strings
  that decode to ASCII text**. The tell was the token `ICAgICAg`, which is base64 for six spaces.
  Check the top examples: `A/1/1544`'s contain substrings that decode to printable ASCII;
  `A/1/2357`'s and `A/1/2364`'s don't.

Sit with that last one. The model doesn't just have a base64 feature. It distinguishes **base64 that
encodes text** from **base64 that encodes binary**. Nobody would have thought to look for that.

> This is the strongest argument for bottom-up interpretability in the paper. Most interpretability
> is top-down: you hypothesise a feature and go look for it. Dictionary learning **surprises you**.
> Like high-low frequency detectors or multimodal neurons in vision — nobody predicted them; they
> were found.

---

## 14. Universality, measured properly

Individual features replicate across seeds. Does the *population*?

For every feature in A/1, find its best match in B/1 by activation correlation:

```
features (A/1 ↔ B/1)   median best-match correlation:  0.72
neurons  (A   ↔ B  )   median best-match correlation:  0.46
```

**Features are more similar to the other model's features than neurons are to the other model's
neurons.** That's the population-level claim, and it's the right comparison: the same models, the
same data, the only difference being which decomposition you look through.

### 14.1 The problem with logit-weight similarity

Do features that fire on the same things also *do* the same things? Not according to the naive
measurement — activation similarity and logit-weight similarity disagree widely.

The extreme case is instructive. `A/1/3949` and `B/1/3321` have activation correlation **0.98** and
**negative** logit-weight correlation. What are they? They fire on `pone` (and sometimes `pgen`,
`pcbi`) — abbreviations for PLOS journals in citations like `@pone.0082392` — and predict the `.`
that follows.

Zoom into the logit scatter and the picture is clear: **`.` is the only token with high weight in
both models.** Everything else is interference. And the model has no reason to care what a feature
does to tokens that were already implausible for other reasons — suppressed by the direct path, by
attention, by other features. Those weights are free to be arbitrary, so they're arbitrary, so they
don't correlate, so they swamp the statistic.

> Aside: this feature fires on 0.02% of tokens, which means at least **1 in 10,000 tokens in the Pile
> is a PLOS journal abbreviation in a citation**. Reading features tells you about your dataset, not
> just your model.

### 14.2 The fix: attribution similarity

What you actually want is "does this feature help predict the same tokens?" The rigorous version —
ablate every feature on every data point and compare the vectors of effects — is too expensive.

The approximation: at each token `t_j`, take the feature's activation and multiply it by the
feature's logit weight **for the token that actually came next**:

```
attribution(i, j)  =  f_i(t_j) · v_{i, t_{j+1}}
```

Stack those over many data points and correlate. This is essentially gradient × activation, ignoring
the softmax and layernorm denominators. It **weights each logit weight by how often it's actually
relevant**, so the interference blob — which is arbitrary and rarely relevant — stops dominating.

Attribution similarity correlates well with activation similarity. **Features that co-activate across
models are also useful for predicting the same tokens.** Which retroactively justifies using plain
activation correlation throughout the paper.

### 14.3 Universality against the literature

Cross-seed universality is the weakest possible version — same architecture, same data. The stronger
version is matching features reported by other people in other models:

- Their own earlier SoLU models had base64, hexadecimal and all-caps **neurons**; A/0 has base64
  (`A/0/45`), hexadecimal (`A/0/119`) and all-caps (`A/0/317`) **features**.
- Smith, applying dictionary learning to the residual stream, found a German detector and title-case
  detectors; here, `A/0/493` and `A/0/508`.
- Gurnee et al.'s "prime factors" and French features; here, `A/4/22414` and `A/0/14`.
- Goh et al.'s multimodal "region neurons"; here, Australia (`A/3/16085`), Canada (`A/3/13683`),
  Africa (`A/3/14490`), Israel-Palestine (`A/3/739`).

And an honest negative: Goh et al.'s striking **person detectors** and **emotion neurons** don't have
clear analogues. Some very narrow person-specific features exist (`A/1/3240` is faintly like a Trump
neuron), but nothing at that level of abstraction. Which is what you'd expect from a one-layer model.

The base64 feature was so reliably universal that its presence became a **debugging heuristic** — if
a new dictionary learning run didn't produce one, something was wrong with the run.

---

## 15. Finite state automata

The most surprising phenomenon in the paper, and the one that gestures at what comes after
decomposition.

Features connect into systems — but **not through weights**. There is no circuit here in the usual
sense. The mechanism is:

> Feature X fires → X raises the probability of certain tokens → one of those tokens is sampled →
> that token causes feature Y to fire → Y raises the probability of other tokens → …

The state machine runs **through the token stream**, not through the network. The model never learned
these assemblies as units; they emerged because the features individually mirror real transition
structure in text. (A model trained with RL might genuinely co-adapt such systems. This one didn't —
it just learned features that happen to interlock.)

**One node, self-loop.** The simplest case. A base64 feature raises the probability of `Qg`, `zA` —
tokens which, if emitted, would keep it firing. A self-sustaining state.

**Two nodes: ALL_CAPS_SNAKE_CASE.** `A/0/207` fires on all-caps text and predicts underscores;
`A/0/358` fires on underscores and predicts all-caps text. Ping-pong, and out comes
`ARRAY_MAX_VALUE`.

**Two nodes: split Unicode.** Tamil characters tokenise as a prefix (`\xe0\xae`, roughly identifying
the Unicode block) and a suffix (identifying the character within it). So: one feature fires on
prefixes and predicts suffixes, another fires on suffixes and predicts new characters or new
prefixes. The model has built a **little decoder for UTF-8** out of two features.

Chinese is the same idea, harder: many characters have dedicated tokens, many don't, and the blocks
are messy. The key structural insight the model found is that *a complete character behaves like the
suffix of a split character* — both can be followed by either a new complete character or a new
prefix. So two features suffice: one firing on complete-characters-or-suffixes, one on prefixes.

**Four nodes: HTML.**

```
A/0/20  fires on open tags  →  predicts tag names
A/0/0   fires on tag names  →  predicts tag closes
A/0/30  fires on tag closes →  predicts whitespace
A/0/494 fires on whitespace →  predicts new open tags
```

Run that loop and you generate `<div>\n\t\t<span>`. Four features, learned independently, composing
into something that emits syntactically valid HTML. (It's incomplete — the A/0 features don't
describe what happens when a tag name is followed by `href`, which enters a more complex state. A/1
would.)

**Context-switching.** A completely separate automaton handles IRC transcripts, generating things
like `<nickonia_> lol ubuntu ;)`. Same `<` character, entirely different state machine, selected by
context. (And, incidentally, evidence about the Pile: it contains a lot of IRC logs about Linux.)

**Memorisation.** In the large runs like A/4, a chain of features functionally memorises the phrase
**"MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE"** — boilerplate from open-source license
headers the model saw thousands of times. The features are nearly binary and fire in one very
specific situation.

Two things to take from that. It matches the mechanistic theory of memorisation from Henighan et al.
— memorised content stored in superposition as near-binary, highly specific features. And it's a form
of **mechanistic anomaly detection**: the model behaves differently in a narrow identifiable case, and
you can *see the mechanism*. That a 512-neuron MLP has room for something this specific is a striking
demonstration of what superposition buys — though, being buried deep in superposition, such
mechanisms are likely very noisy.

---

## 16. What this changed about the theory

### 16.1 Superposition isn't isotropic

The picture inherited from Toy Models: features are discrete one-dimensional directions that repel
each other due to interference, ending up roughly evenly spread.

What this paper found instead:

- Features **clump** into dense groups of related features.
- The reason is probably not only correlated *activation* but shared **action** — the digit-base64
  feature and the letter-base64 feature predict nearly the same token set, so their directions end up
  nearly parallel.
- Features may not even be one-dimensional. There may be higher-dimensional **feature manifolds** —
  continuous families rather than discrete points. (The convex hull of a cluster of correlated
  features is arguably already a manifold; and some manifolds wouldn't decompose into any finite set
  of one-dimensional features, which would explain why splitting seems to just keep going.)

Consequence: **"the correct number of features" may not be a well-posed question.** In the versions
where it is, getting it exactly right doesn't matter much, because you fail gracefully into a coarser
resolution.

What *did* survive intact: the linear representation hypothesis and superposition itself. The number
of interpretable features found, the way activation magnitude tracks confidence, the sensibleness of
the logit weights, and the observable interference weights are all exactly what superposition
predicts.

### 16.2 Are token-in-context features real?

The uncomfortable finding. Hundreds of features for `the`, differing only by context. Why?

In coding terms: representing "*the* in Physics" as its own unit is a **local code**. The intuitive
alternative is a **compositional code** — one feature for `the`, another for Physics, combined. Local
codes are less elegant and much less compact.

Two hypotheses:

1. The transformer uses a compositional code and the dictionary learning is producing a local one as
   an artifact — plausible, because local codes are *sparser*, and the L1 penalty rewards sparsity. A
   better objective might recover the compositional version.
2. The transformer really is using a local code, at least partly.

They lean toward (2), and the argument is good. If the model represented `the` and Physics
independently, its logits would be forced to be the **sum** of "tokens that follow *the*" and "tokens
common in Physics". That's a strictly weaker prediction than "tokens that follow *the* **in
Physics**". A compositional code can't express interactions. **If the model wants sharp predictions,
it has to pay for a local code.**

Feature splitting supports this too: the split features have genuinely different logit weights, not
just different activations. `A/0/341` (*the* in mathematics generally) predicts `the denominator`,
`the remainder`, `the theorem`. Its split children are far more specific — `A/2/15021` (machine
learning) predicts `the dataset`, `the classifier`; `A/2/4878` (abstract algebra and topology)
predicts `the quotient`, `the subgroup`; `A/2/2609` (gravitation and field theory) predicts `the
gauge`, `the Lagrangian`, `the spacetime`. Those distinctions are doing real predictive work.

---

## 17. A short field guide to the plots

The same handful of chart shapes carry almost all the evidence. Worth being able to read them.

**Activation histogram coloured by proxy.** Feature activation on the x-axis, token count on the
y-axis, coloured by whether the computational proxy fires. *Reading it:* you want the colour to
concentrate at high activations. *If the claim were false:* colour spread evenly across the range, or
a strong wrong-coloured mode at high activation.

**Expected value plot.** The same histogram, but each token weighted by the activation value. *Why:*
answers "where does this feature's influence live?" rather than "where do its firings live". A
feature can fire noisily 10,000 times at 0.2 and cleanly 100 times at 8 and still be almost entirely
clean *in effect*.

**Logit weight histogram.** Weight on the x-axis, vocabulary tokens binned. *Reading it:* look for
**bimodality** — a big mode near zero (tokens the feature doesn't care about) and a small distant mode
(tokens it pushes). The second mode should be recognisably about the same thing the activations are
about. That agreement is the cross-validation.

**A-vs-B scatter (activations, or logit weights).** One model's feature on each axis. *Reading it:* a
tight diagonal cluster of the tokens that matter, plus a diffuse central blob of interference. Judge
the cluster, not the overall correlation coefficient — the blob dominates the statistic and means
nothing.

**Feature-vs-neuron scatter.** Same shape, different question. Ask whether **each axis separately**
separates the concept. In the Arabic case the feature axis does and the neuron axis doesn't; the
marginals tell the story more clearly than the joint.

**Feature density histogram (log scale).** Fraction of tokens each feature fires on. *Reading it:*
count live features and note the minimum density reached. Watch for the bimodality — the ultralow
cluster around 10⁻⁷ is an artifact, the high-density cluster around 10⁻⁵ is where the real features
are.

**Ablation underlines.** In the feature browser, an orange background marks where the feature fired;
**blue underlines** mark tokens whose prediction got *worse* when it was ablated (so the feature was
helping), **red/orange underlines** tokens whose prediction got *better*. Background = activation.
Underline = causal effect. They should tell the same story one token apart.

---

## 18. What this does not show

Stated plainly, mostly by the paper itself:

- **One layer.** Features are close to linear here almost by construction, since the MLP output goes
  nearly straight to the logits. That's exactly why the analysis was tractable, and exactly why it
  might not transfer. (Others have since found interpretable features in multi-layer models, which
  helps.)
- **MLP only.** Attention has the same motivations for superposition and no demonstrated solution.
  The paper flags attentional superposition as a likely future bottleneck.
- **No complete account of the layer.** 79% of the MLP's loss contribution is recovered against a
  generous baseline, and there's no principled way to say how many features remain. Density
  histograms show that widening the dictionary keeps finding **rarer** features, with no sign of
  saturation — 512 neurons are still yielding new features at 131,072 dictionary entries.
- **Low activations are murkier.** Interpretability degrades at the bottom of the spectrum, and it's
  unresolved whether that's proxy error, model calibration, or slightly-wrong feature directions.
- **The ultralow density cluster is unexplained.** Known artifact, reproduced independently, cause
  unknown.
- **No good metric.** The central methodological problem. Choosing λ and dictionary size is guided by
  proxies and taste.
- **Scaling is an open engineering problem.** A 100× autoencoder on a single 10,000-wide MLP layer is
  ~20 billion parameters, and rare features may require training on a large fraction of the base
  model's corpus. Training the interpreter could plausibly cost more than training the model.

---

## 19. The argument, told slowly

Here is the whole thing once more, as a story rather than as a case. No figures, no correlation
coefficients, no run names — just the line of reasoning, one step at a time. If you have read this
far, this is a place to let it settle. If you have just arrived, this is a reasonable place to
begin.

**Start with the ordinary situation.**

You have a trained transformer. It works. You would like to know what it is doing — not
statistically, but mechanically. Which parts do what, and how the parts fit together.

The plan almost writes itself. Break the model into components. Work out what each component does.
Work out how they compose. That is how you come to understand any other complicated machine.

So you need components. And the model hands you an obvious candidate: the neuron. One dimension of
the MLP's hidden layer, one number per token. You do not have to invent it. It is right there in the
architecture, and it is what the non-linearity acts on.

**Then you look at one.**

You take a neuron and you find the text that makes it fire hardest. What comes back is a list:
academic citations, English dialogue, HTTP requests, Korean text.

Not a concept. A list.

It is worth pausing on why this is worse than it first sounds. The problem is not that the neuron is
hard to describe. The problem is that it cannot be described *on its own*. Knowing it fired tells
you that one of four unrelated things is happening, and to find out which, you have to consult the
other five hundred and eleven neurons. The component has no meaning independent of its context —
which is exactly the property that made components worth having in the first place.

And you cannot go around it. There are transformers you can analyse without ever looking at hidden
activations, but they are the ones with no MLP. Put a ReLU in the middle and the activation vector
becomes something you have to face. A one-layer transformer with a single MLP block is, in the
authors' phrase, the simplest language model we profoundly do not understand.

**Now the explanation for why neurons look like that.**

Suppose the meaningful units in the model are not neurons but *directions* — arbitrary directions in
the 512-dimensional activation space, most of which do not line up with any axis. And suppose the
model has more of these directions than it has dimensions to give them.

That sounds like it cannot work, and there are two reasons it does.

The first is that high-dimensional spaces are more spacious than they look. In 512 dimensions you
can find exactly 512 mutually perpendicular directions — but if you will accept *nearly*
perpendicular, you can find an enormous number of them. Interference exists, but it is small.

The second is that the features are rare. On any given token only a handful are active. Two
directions that are not quite perpendicular only interfere when both are switched on at once, and
mostly they are not. The interference stays below the threshold where it would matter, and a ReLU
takes care of the rest.

Put those together and the layer is doing something strange and rather beautiful: a small dense
network running a noisy simulation of a much larger, much sparser one.

And now the neuron makes sense. A neuron is one axis. If ten thousand feature directions are
scattered through 512 dimensions, every single axis has some overlap with hundreds of them. Reading
a neuron means reading hundreds of features at once, projected onto one line. Citations, dialogue,
HTTP, Korean — that was never a meaning. It was a cross-section.

**There is an obvious thing to try, and it does not work.**

If the crowding is what breaks the neurons, uncrowd the model. Train it with heavy pressure toward
sparse activations — in the limit, let only one neuron fire at a time. Accept a worse model in
exchange for a readable one.

They tried this properly, and what they found is the most quietly important result in the paper.
You can remove the crowding entirely and the neurons are *still* polysemantic.

The reason is a small piece of arithmetic. Imagine a single neuron, and four mutually exclusive
things it might detect, each of which would tell you exactly what comes next. If the neuron commits
to one of them and gets it right, it is silent and ignorant three quarters of the time, and the loss
works out around 0.82. If instead it fires on two of them and predicts a blend, it is half-right
much more often, and the loss works out around 0.69.

The blurry neuron wins. With one neuron. Where crowding is not even possible.

So this is not the model running out of room. It is cross-entropy doing what cross-entropy does:
rewarding you for being half-right about many things over being fully right about one. No
architectural change removes that incentive, because the incentive is in the loss.

**Which settles the strategy.**

Leave the model alone. Train it normally, then take its activations apart afterwards.

And "take a vector apart into a sparse combination of a large set of building blocks" is not a new
problem. It is dictionary learning, and it has a long history.

It also has a specific difficulty, worth naming because it explains why the result is surprising at
all. Given the building blocks, recovering which ones produced a given activation means solving for
a long vector from a short one. There are infinitely many answers. The only thing that picks one out
is the requirement that the answer be sparse — and finding the sparsest answer exactly is, in
general, computationally hard. Sparse structure is easy to store in a small space and genuinely
difficult to get back out.

**The tool is deliberately modest.**

A small autoencoder. It reads the MLP activation vector, expands it into a much wider hidden layer —
eight times wider, or two hundred and fifty-six times wider — and then compresses it back and tries
to reproduce what it read. It is penalised for reconstruction error and penalised again for using
too many hidden units at once.

The hidden units are the candidate features. The columns of the output matrix are their directions.

Two things about this choice matter. It is trained with squared error rather than cross-entropy,
which is not incidental: it means the decomposition does not inherit the incentive that made the
model's neurons blurry in the first place. And it is *weak on purpose*. Cleverer dictionary learning
algorithms exist, and the worry about them is that they might extract structure from the activations
that the transformer itself could never use — leaving you with a beautiful interpretation of
something the model is not doing. An autoencoder is about as capable as an MLP layer, which is a
fair bar.

**Then the question that decides everything: how would you know if these were made up?**

The answer is the cleanest idea in the paper, and it comes from what the autoencoder was *not*
shown.

It only ever sees MLP activations. It never sees the output weights, never sees the unembedding,
never sees the loss, never sees a single predicted token. Half the model is hidden from it
completely.

So take a feature it found, and go look at that hidden half. Compute what the feature does to the
output logits — in a one-layer model this is one matrix product. Erase the feature from a real
forward pass and see which predictions get worse. Clamp it high and see what the model writes.

If a feature discovered by reconstructing inputs turns out to have a coherent, matching effect on
outputs, that agreement cannot be overfitting. The thing being predicted was never fit.

That is the shape of the evidence: fit on the input side, check on the output side.

**And it holds.**

A feature that fires on Arabic script turns out to push the model toward the specific byte pairs
that begin Arabic characters. Remove it and every Arabic prediction gets worse, while a shared
punctuation mark gets better. Clamp it high after a prompt counting to ten, and the model writes
Arabic.

A feature that fires on DNA sequences fires on the `5'-` prefix as well, before any nucleotides
appear — because what follows that prefix is going to be DNA. It is not detecting the context. It is
predicting it.

None of these are neurons. The Arabic feature is spread across dozens of them, its three largest
components pointing the wrong way, and it appears in no neuron's top examples. Train a second model
from a different random seed and the same features come back.

**The four studied closely were chosen for being easy to check, so the obvious worry is the rest.**

A blinded annotator scored features and neurons across their whole activation range — not just their
top examples, which is where this kind of analysis usually fools itself. The median neuron scored
zero: no hypothesis could be formed at all. The median feature scored twelve out of fourteen.

Then the same question asked mechanically. Have a language model write an explanation of a feature
from *when it fires*, and then use only that explanation to guess *what it makes more likely*. Two
halves of the model, connected by nothing but the hypothesis. Chance is fifty percent; neurons come
in at fifty-eight; features at seventy-four.

And the control that matters most: shuffle the entries of the trained model's weight matrices, so
every weight distribution survives and only the structure dies, then run the whole procedure again.
What comes back is a pile of features that fire on single tokens, and beyond that, nothing
interpretable. The data supplies the trivial structure. Everything else came from training.

**What is learned, once you have the features.**

Three things stand out.

The first is that features arrive in families, and the size of your dictionary is a *resolution*
setting rather than a number you must guess correctly. Ask for 512 features and you get one base64
feature. Ask for 4,096 and it has become three: one for letters, one for digits, and one for base64
that happens to decode into readable text. The digit one is the strangest and the most convincing —
it declines to predict digits, because the tokeniser would have merged two consecutive digits into a
single token, so a lone digit is real evidence that the next token is not one. The model learned a
fact about its own tokeniser. Nobody would have thought to look.

The second is that features recur. Train a second model, learn a second dictionary, and the features
match each other far better than the two models' neurons do. Features found here also match features
other researchers reported in other models entirely.

The third is that features chain together — not through weights, but through text. One feature
raises the probability of certain tokens; one of those tokens gets emitted; that token switches on
the next feature. Four such features, learned independently, form a loop that emits syntactically
valid HTML. Another chain memorises the licence boilerplate that appears in millions of source
files. All of this inside a single layer, 512 neurons wide.

**What it does not settle.**

One layer, and the MLP only. Attention is untouched, and has all the same reasons to be crowded.
There is no principled way yet to know how many features remain undiscovered — widening the
dictionary keeps finding rarer ones with no sign of stopping. There is no reliable metric for
whether a dictionary is a good one; the choice is still guided by proxies and judgement. And scaling
this to a frontier model is a serious engineering problem, possibly a more expensive one than
training the model was.

**What it is, in the end.**

The plan was: break the model into components, understand each, understand how they compose.

This is step one, done convincingly, for one very small model. The components are not neurons. They
are a larger, sparse set of directions, and you can find them with a small autoencoder trained to
reconstruct what the layer was already doing.

That is not an understanding of a language model. It is the thing you needed before you could start.

---

## 20. The crux, compressed

If you keep six things:

1. **Neurons are the wrong unit.** They're polysemantic because the model packs more features into
   the layer than it has dimensions, giving each a direction rather than a neuron, and relying on
   sparsity to keep the interference tolerable.

2. **You can't fix this by changing the architecture.** Cross-entropy actively prefers polysemantic
   representations even with superposition ruled out — being half-right about two things beats being
   right about one. So the decomposition has to be post-hoc, and it has to use a different loss
   (MSE), or superposition just recurs inside the decomposition.

3. **Stated formally, superposition is a dictionary learning problem**, and a deliberately weak
   sparse autoencoder — MSE reconstruction plus an L1 penalty, trained on billions of activations —
   solves it well enough. Weak on purpose: the model can't do NP-hard sparse recovery on its own
   activations, so neither should the tool.

4. **The features are real, and the proof is that they were never fit to be.** Dictionary learning
   sees only MLP activations. It never sees the output side. Yet the features have coherent logit
   weights, correct ablation effects, and steer generation when clamped. That agreement is not
   available to overfitting.

5. **The features are not neurons and not artifacts of the data.** The Arabic feature is spread over
   dozens of neurons with its three largest coefficients negative, and is invisible in every neuron's
   top examples. Shuffle the model's weights and the interesting features disappear, leaving only
   single-token ones.

6. **Dictionary size is a resolution knob, not a guess you have to get right.** Features split into
   families as the dictionary widens — one base64 feature becomes letters-in-base64,
   digits-in-base64 (a tokeniser artifact the model learned to exploit), and
   base64-that-decodes-to-ASCII. Too few features gives a blurry picture, not a wrong one.

And the thing that makes it more than a method paper: the model turns out to contain structure nobody
would have gone looking for. A feature for base64 that encodes text. A four-feature loop that emits
valid HTML. A chain that memorises a software license header. All in one layer, 512 neurons wide.

---

## 21. Notation and glossary

| Term | Meaning |
|---|---|
| **Polysemantic** | A neuron (or unit) that responds to multiple unrelated things |
| **Monosemantic** | Responds to one coherent thing — the goal |
| **Feature** | A direction `d_i` in activation space with an activation `f_i(x) ≥ 0`. Three equivalent views: a direction (column of `W_d`), a detector (row of `W_e`), an action (a vector of logit weights) |
| **Superposition** | Representing more features than dimensions by assigning each a direction, relying on sparsity |
| **Overcomplete basis** | More directions than dimensions — `m > d_MLP` |
| **Dictionary learning** | Finding a set of atoms such that each data point is a sparse combination of a few of them |
| **Sparse autoencoder / SAE** | The weak dictionary learning method used here: `ReLU(W_e(x − b_d) + b_e)` then `W_d f + b_d`, trained on MSE + λ‖f‖₁ |
| **Expansion factor** | Dictionary size ÷ number of neurons. A/1 is 8×; A/5 is 256× |
| **L0 norm** | Average number of non-zero features per token. Target < 10–20 |
| **Feature density** | Fraction of tokens a feature fires on |
| **Ultralow density cluster** | Features firing on < 1 in 10⁶ tokens; a training artifact, uninterpretable, excluded |
| **Logit weight** | A feature's linear effect on each output token: `d_i · W_down · π · L · W_unembed` |
| **Interference weights** | The diffuse near-zero mode of logit weights — arbitrary opinions inherited from non-orthogonality. Noise, not signal |
| **Computational proxy** | A hand-written scorer, `log(P(s|context)/P(s))`, standing in for a human judging whether a context is present |
| **Feature splitting** | One feature in a small dictionary becoming several more specific ones in a larger dictionary |
| **Activation similarity** | Correlation of two features' activations over a large token sample |
| **Logit weight similarity** | Correlation of two features' logit weight vectors — misleading, dominated by interference |
| **Attribution similarity** | Correlation of `f_i(t_j) · v_{i,t_{j+1}}` vectors — activation weighted by relevance to what actually came next. The good one |
| **Pinned feature sampling** | Clamping a feature to a high value and sampling, to see what it makes the model do |
| `A/1/3450` | Model A, dictionary run 1, feature 3450 |
| `A/neurons/489` | Neuron 489 of model A |
| **A/0 … A/5** | Runs with fixed L1 coefficient and dictionary sizes 512 (1×) → 131,072 (256×) |
