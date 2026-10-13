# Fits the definition confidence model from hand-judged candidates and prints it as JS.
#   python3 engine/bench/fit-definitions.py rows.json   (rows.json: from test/dump-judged.mjs)
# Checked by leaving whole lectures out, so the number printed is not the training fit.
import json, sys, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
rows = json.load(open(sys.argv[1]))
keys = list(rows[0]["f"].keys())
X = np.array([[r["f"][k] for k in keys] for r in rows], float)
y = np.array([r["y"] for r in rows]); lec = np.array([r["lec"] for r in rows])
C = 0.3
p = np.zeros(len(y))
for l in np.unique(lec):
    te = lec == l
    m = LogisticRegression(C=C, max_iter=5000).fit(X[~te], y[~te]); p[te] = m.predict_proba(X[te])[:, 1]
print("leave-one-lecture-out AUC", round(roc_auc_score(y, p), 3))
for th in [0.3, 0.4, 0.5, 0.6]:
    k = p >= th; tp = int((k & (y == 1)).sum())
    print(f"  threshold {th}: kept {int(k.sum())}, real {tp} ({tp/max(1,k.sum()):.0%}), {tp/y.sum():.0%} of all real")
m = LogisticRegression(C=C, max_iter=5000).fit(X, y)
w = {k: round(float(v), 4) for k, v in zip(keys, m.coef_[0])}
print("const DEFINITION_MODEL = " + json.dumps({"bias": round(float(m.intercept_[0]), 4), "weights": w}) + ";")
