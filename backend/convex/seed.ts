import { internalMutation } from "./_generated/server";
import { ensureRoom } from "./lib/room";
import { lessonNumberFields } from "./lib/lessonNumber";

const F = "```"; // code fence (kept out of String.raw templates)

const FULL_LESSONS: { title: string; content: string }[] = [
  {
    title: "Introduction to AI",
    content: String.raw`# Lesson 1 — Introduction to AI

**Artificial Intelligence** is the study of building systems that perform tasks we
associate with intelligence: perceiving, reasoning, learning and acting.

## Three flavours of learning

| Paradigm | Signal | Example |
|---|---|---|
| Supervised | labelled examples $(x, y)$ | spam detection |
| Unsupervised | structure in $x$ alone | customer clustering |
| Reinforcement | reward $r_t$ | game-playing agents |

A model is just a function $f_\theta$ with parameters $\theta$ that we *learn* from data:

$$
\hat{y} = f_\theta(x), \qquad \theta^* = \arg\min_\theta \; \frac{1}{N}\sum_{i=1}^{N} \mathcal{L}\big(f_\theta(x_i), y_i\big)
$$

${F}python
# The simplest possible "learner": predict the average
def fit(ys):
    return sum(ys) / len(ys)

prediction = fit([3, 5, 7])
print(f"Predict {prediction} for every input")
${F}

> **Note:** every model in this course is a refinement of this idea —
> choose a family of functions, then pick the member that minimises a loss.
`,
  },
  {
    title: "Linear Regression",
    content: String.raw`# Lesson 2 — Linear Regression

We model the target as a straight line: $\hat{y} = w x + b$.

## Mean Squared Error

$$
\text{MSE}(w, b) = \frac{1}{N} \sum_{i=1}^{N} \big(y_i - (w x_i + b)\big)^2
$$

The closed-form (least squares) solution in matrix form is
$\mathbf{w} = (X^\top X)^{-1} X^\top \mathbf{y}$.

${F}python
import numpy as np

x = np.array([1, 2, 3, 4, 5], dtype=float)
y = np.array([2.1, 3.9, 6.2, 7.8, 10.1])

X = np.column_stack([x, np.ones_like(x)])     # add bias column
w, b = np.linalg.lstsq(X, y, rcond=None)[0]
print(f"y ≈ {w:.2f}·x + {b:.2f}")
${F}

> **Note:** linear regression is *linear in the parameters* — you can still fit
> curves by adding features like $x^2$.
`,
  },
  {
    title: "Perceptrons",
    content: String.raw`# Lesson 3 — Perceptrons

The perceptron (Rosenblatt, 1958) is a binary classifier:
$\hat{y} = \operatorname{sign}(\mathbf{w}\cdot\mathbf{x} + b)$.

## Learning rule

For each misclassified example $(\mathbf{x}_i, y_i)$ with $y_i \in \{-1, +1\}$:

$$
\mathbf{w} \leftarrow \mathbf{w} + \eta \, y_i \, \mathbf{x}_i, \qquad b \leftarrow b + \eta \, y_i
$$

${F}python
import numpy as np

def perceptron(X, y, lr=1.0, epochs=20):
    w, b = np.zeros(X.shape[1]), 0.0
    for _ in range(epochs):
        for xi, yi in zip(X, y):
            if yi * (xi @ w + b) <= 0:      # mistake
                w += lr * yi * xi
                b += lr * yi
    return w, b

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y = np.array([-1, -1, -1, 1])               # logical AND
print(perceptron(X, y))
${F}

> **Note:** a single perceptron cannot learn XOR — the data is not linearly separable.
`,
  },
  {
    title: "Neural Networks",
    content: String.raw`# Lesson 4 — Neural Networks

Stack perceptron-like units in layers and insert a **non-linearity** $\sigma$ between them.

## Forward pass of a 2-layer network

$$
\mathbf{h} = \sigma\!\left(W_1 \mathbf{x} + \mathbf{b}_1\right), \qquad
\hat{\mathbf{y}} = \operatorname{softmax}\!\left(W_2 \mathbf{h} + \mathbf{b}_2\right)
$$

Common activations: ReLU $\max(0, z)$, sigmoid $\frac{1}{1+e^{-z}}$, and $\tanh z$.

${F}python
import numpy as np

def relu(z):
    return np.maximum(0, z)

def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()

rng = np.random.default_rng(0)
W1, b1 = rng.normal(size=(4, 2)), np.zeros(4)
W2, b2 = rng.normal(size=(3, 4)), np.zeros(3)

x = np.array([0.5, -1.2])
probs = softmax(W2 @ relu(W1 @ x + b1) + b2)
print(probs.round(3), probs.sum())
${F}

> **Note:** with one hidden layer and enough units, a network can approximate any
> continuous function (the universal approximation theorem).
`,
  },
  {
    title: "Gradient Descent",
    content: String.raw`# Lesson 5 — Gradient Descent

To minimise a loss $\mathcal{L}(\theta)$, repeatedly step *downhill* along the negative gradient.

## Update rule

$$
\theta_{t+1} = \theta_t - \eta \, \nabla_\theta \mathcal{L}(\theta_t)
$$

The learning rate $\eta$ matters: too small is slow, too large diverges.

${F}python
def loss(w):
    return (w - 3) ** 2          # minimum at w = 3

def grad(w):
    return 2 * (w - 3)

w, lr = 0.0, 0.1
for step in range(25):
    w -= lr * grad(w)
print(f"w = {w:.4f}, loss = {loss(w):.6f}")
${F}

> **Note:** *stochastic* gradient descent estimates $\nabla\mathcal{L}$ from a
> mini-batch, trading accuracy per step for many more steps per second.
`,
  },
];

function placeholder(n: number) {
  return {
    title: `Lesson ${n} (coming soon)`,
    content: `# Lesson ${n}\n\n_Content coming soon._\n`,
  };
}

/** `npx convex run seed:default` — idempotent. */
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    for (let n = 1; n <= 40; n++) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_number", (q) => q.eq("lessonNumber", String(n)))
        .first();
      if (existing) continue;
      const data = n <= FULL_LESSONS.length ? FULL_LESSONS[n - 1] : placeholder(n);
      await ctx.db.insert("lessons", {
        ...lessonNumberFields(String(n)),
        title: data.title,
        content: data.content,
        isLocked: n > FULL_LESSONS.length,
        isHidden: false,
      });
      created++;
    }
    const room = await ensureRoom(ctx);
    return { lessonsCreated: created, roomId: room._id };
  },
});

/**
 * `npx convex run seed:reset` — wipes lessons, polls, votes and the room
 * (teacher accounts are kept). Run `seed:default` afterwards to re-seed.
 */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of ["votes", "polls", "classroomState", "lessons"] as const) {
      for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
    }
  },
});
