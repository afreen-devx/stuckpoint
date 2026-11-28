"""
Builds packs/KIN-02.json: pre-test (A), post-test (B) and retention test (C). Every number in a correct option, and every number in a wrong option,
is computed here from the physics (g = 10 m/s^2). A mismatch stops the build.
Option order is fixed per question so the correct letter is spread across A to D.
"""
import json, math, sys

G = 10.0
base = json.load(open(sys.argv[1]))  # KIN-01, for misconceptions, conventions, foundations
Q, GRAPHS = {}, {}

def fmt(x, d=1):
    s = f"{x:.{d}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s

def close(a, b, tol=1e-6):
    assert abs(a - b) < tol, (a, b)

def q(qid, stem, opts, graph=None, correct_at=0):
    """opts: list of (text, tag) with the correct one first; correct_at moves it to that slot."""
    assert sum(1 for _, t in opts if t is None) == 1 and opts[0][1] is None
    texts = [t for t, _ in opts]
    assert len(set(texts)) == 4, texts
    order = opts[1:]
    order.insert(correct_at, opts[0])
    Q[qid] = {"stem": stem, "options": [t for t, _ in order], "tags": [g for _, g in order]}
    if graph: Q[qid]["graph"] = graph

# ---------- M1: zero velocity means zero acceleration ----------
u, t = 20, 2.0
v = u - G * t; close(v, 0)
q("Q1", f"A ball is thrown straight up at {u} m/s. Find its velocity and acceleration {fmt(t)} s after it is thrown.",
  [(f"Velocity 0, acceleration 10 m/s² downward", None),
   ("Velocity 0, acceleration 0", "M1"),
   ("Velocity 0, acceleration 10 m/s² upward", "M3"),
   (f"Velocity {fmt(u - G * 1)} m/s upward, acceleration 10 m/s² downward", "C0")], correct_at=1)

u, a = 6.0, 3.0
t_stop = u / a; close(t_stop, 2.0)
q("Q2", f"A trolley rolls up a smooth ramp at {fmt(u)} m/s. It slows at a constant {fmt(a)} m/s² and stops for an instant at t = {fmt(t_stop)} s. What is its acceleration at that instant?",
  [(f"{fmt(a)} m/s² down the ramp", None),
   ("Zero, because it is not moving", "M1"),
   (f"{fmt(a)} m/s² up the ramp", "M3"),
   (f"{fmt(u * t_stop)} m/s² down the ramp", "C0")], correct_at=2)

# ---------- M2: negative acceleration always means slowing ----------
v1, v3 = -G * 1, -G * 3
q("Q3", "Taking upward as positive, a stone is dropped from a tall tower, so its acceleration is −10 m/s². Its velocity is −10 m/s at t = 1 s and −30 m/s at t = 3 s. Between these times the stone is:",
  [(f"Speeding up, from {fmt(-v1)} m/s to {fmt(-v3)} m/s", None),
   ("Slowing down, because its acceleration is negative", "M2"),
   ("Slowing down, because its velocity fell from −10 to −30", "M6"),
   ("Moving at constant speed, because its acceleration is constant", "M1")], correct_at=0)

u, a, t = -20.0, -2.0, 5.0
vend = u + a * t; close(vend, -30)
q("Q4", f"A car moves in the −x direction with velocity −{fmt(abs(u))} m/s and a constant acceleration of −{fmt(abs(a))} m/s². What is its speed after {fmt(t)} s?",
  [(f"{fmt(abs(vend))} m/s, it has sped up", None),
   (f"{fmt(abs(u) + a * t)} m/s, the negative acceleration slowed it", "M2"),
   (f"{fmt(abs(vend))} m/s, but it has slowed down since −30 is less than −20", "M6"),
   (f"{fmt(abs(u) + abs(a) * t / 2)} m/s, it has sped up", "C0")], correct_at=3)

# ---------- M3: acceleration points the way the object moves ----------
u, t = 15.0, 1.0
v = u - G * t; close(v, 5)
q("Q5", f"A ball is thrown straight up at {fmt(u)} m/s. At t = {fmt(t)} s it is still rising. Find its velocity and acceleration at that moment.",
  [(f"{fmt(v)} m/s up, 10 m/s² down", None),
   (f"{fmt(v)} m/s up, 10 m/s² up", "M3"),
   (f"{fmt(v)} m/s up, zero acceleration", "M1"),
   (f"{fmt(u + G * t)} m/s up, 10 m/s² down", "C0")], correct_at=2)

u, t = 12.0, 4.0
a = u / t; close(a, 3)
q("Q6", f"A cyclist moving east at {fmt(u)} m/s brakes evenly and stops in {fmt(t)} s. During braking, the acceleration is:",
  [(f"{fmt(a)} m/s² west", None),
   (f"{fmt(a)} m/s² east, the way she is moving", "M3"),
   ("Zero, because she ends at rest", "M1"),
   (f"{fmt(u * t)} m/s² west", "C0")], correct_at=1)

# ---------- M4: graph as a picture ----------
GRAPHS["q7"] = {"xLabel": "t (s)", "yLabel": "x (m)", "xMax": 10, "yMax": 20,
                "lines": [{"points": [[0, 0], [4, 20], [6, 20], [10, 0]]}]}
v_back = (20 - 0) / (10 - 6); close(v_back, 5)
q("Q7", "The position-time graph of a car on a straight road is shown. Between t = 6 s and t = 10 s, the car:",
  [(f"Moves back toward its start at {fmt(v_back)} m/s", None),
   ("Drives down the far side of a hill", "M4"),
   ("Slows down, because the graph goes down", "M5"),
   (f"Moves back toward its start at {fmt(20 / 5)} m/s", "C0")], graph="q7", correct_at=0)

GRAPHS["q8"] = {"xLabel": "t (s)", "yLabel": "v (m/s)", "xMax": 8, "yMax": 20,
                "lines": [{"points": [[0, 10], [4, 10], [8, 0]]}]}
dec = 10 / 4; close(dec, 2.5)
q("Q8", "The velocity-time graph of a cyclist is shown. What happens between t = 4 s and t = 8 s?",
  [(f"She slows down at {fmt(dec)} m/s² and stops", None),
   ("She rides down a hill", "M4"),
   ("She rides back toward where she started", "M5"),
   (f"She slows down at {fmt(10 / 8, 2)} m/s² and stops", "C0")], graph="q8", correct_at=3)

# ---------- M5: wrong graph feature ----------
GRAPHS["q9"] = {"xLabel": "t (s)", "yLabel": "v (m/s)", "xMax": 8, "yMax": 24,
                "lines": [{"points": [[0, 0], [6, 18]]}]}
dist = 0.5 * 6 * 18; close(dist, 54)
q("Q9", "The velocity-time graph of a car starting from rest is shown. How far does it travel in the first 6 s?",
  [(f"{fmt(dist)} m", None),
   ("18 m", "M5"),
   ("3 m", "M5"),
   (f"{fmt(6 * 18)} m", "C0")], graph="q9", correct_at=2)

GRAPHS["q10"] = {"xLabel": "t (s)", "yLabel": "x (m)", "xMax": 10, "yMax": 40,
                 "lines": [{"points": [[0, 10], [5, 40]]}]}
vel = (40 - 10) / 5; close(vel, 6)
q("Q10", "The position-time graph of a toy car is shown. What is its velocity?",
  [(f"{fmt(vel)} m/s", None),
   ("40 m/s", "M5"),
   (f"{fmt(40 / 5)} m/s", "M5"),
   ("125 m/s", "M5")], graph="q10", correct_at=1)

# ---------- M6: distance and displacement are the same ----------
d1, d2, tt = 30, 40, 50
dist, disp = d1 + d2, math.hypot(d1, d2); close(disp, 50)
q("Q11", f"A student walks {d1} m east and then {d2} m north, taking {tt} s in total. Find her average speed and the size of her average velocity.",
  [(f"{fmt(dist / tt)} m/s and {fmt(disp / tt)} m/s", None),
   (f"{fmt(dist / tt)} m/s and {fmt(dist / tt)} m/s", "M6"),
   (f"{fmt(disp / tt)} m/s and {fmt(disp / tt)} m/s", "M6"),
   (f"{fmt(dist / tt)} m/s and {fmt((d2 - d1) / tt)} m/s", "C0")], correct_at=3)

h1, h2 = 5.0, 3.2
q("Q12", f"A ball is dropped from {fmt(h1)} m, bounces, and rises to {fmt(h2)} m. From release to the top of the bounce, find the distance travelled and the displacement.",
  [(f"{fmt(h1 + h2)} m, and {fmt(h1 - h2)} m downward", None),
   (f"{fmt(h1 + h2)} m, and {fmt(h1 + h2)} m downward", "M6"),
   (f"{fmt(h1 - h2)} m, and {fmt(h1 - h2)} m downward", "M6"),
   (f"{fmt(h1 + h2)} m, and {fmt(h1 - h2)} m upward", "C0")], correct_at=0)

# ---------- M7: average speed is the mean of the speeds ----------
s, v1, v2 = 60, 30, 60
avg = 2 * s / (s / v1 + s / v2); close(avg, 40)
q("Q13", f"A bus covers the first {s} km of a trip at {v1} km/h and the next {s} km at {v2} km/h. What is its average speed for the whole trip?",
  [(f"{fmt(avg)} km/h", None),
   (f"{fmt((v1 + v2) / 2)} km/h", "M7"),
   (f"{fmt(v1 + v2)} km/h", "C0"),
   (f"{fmt(2 * s / 4)} km/h", "C0")], correct_at=1)

v1, v2 = 4, 12
avg = 2 * v1 * v2 / (v1 + v2); close(avg, 6)
q("Q14", f"A cyclist rides up a hill at {v1} m/s and comes back down the same road at {v2} m/s. What is her average speed for the round trip?",
  [(f"{fmt(avg)} m/s", None),
   (f"{fmt((v1 + v2) / 2)} m/s", "M7"),
   ("0 m/s, because she ends where she started", "M6"),
   (f"{fmt(v1 + v2)} m/s", "C0")], correct_at=2)

# ---------- M8: heavier objects fall faster ----------
h = 45
tf = math.sqrt(2 * h / G); close(tf, 3)
q("Q15", f"A 1 kg ball and a 5 kg ball are dropped together from {h} m. Ignore air resistance. When does each land?",
  [(f"Both land after {fmt(tf)} s", None),
   (f"The 5 kg ball lands first, after {fmt(tf / 5)} s", "M8"),
   (f"The 1 kg ball takes {fmt(tf)} s and the 5 kg ball about {fmt(tf / math.sqrt(5))} s", "M8"),
   (f"Both land after {fmt(h / G)} s", "C0")], correct_at=3)

g_moon, h = 1.6, 1.8
tm = math.sqrt(2 * h / g_moon); close(tm, 1.5)
q("Q16", f"On the Moon (no air, g = {fmt(g_moon)} m/s²), an astronaut drops a hammer and a feather together from {fmt(h)} m. What happens?",
  [(f"Both land together after {fmt(tm)} s", None),
   ("The hammer lands well before the feather", "M8"),
   ("The hammer lands first, but only slightly, since there is no air", "M8"),
   (f"Both land together after {fmt(math.sqrt(2 * h / G), 1)} s", "C0")], correct_at=0)

# ---------- M9: horizontal speed changes the fall time ----------
h, vx = 20, 15
tf = math.sqrt(2 * h / G); close(tf, 2)
q("Q17", f"From a {h} m cliff, ball A is dropped and ball B is thrown horizontally at {vx} m/s at the same moment. Ignore air resistance. Which is right?",
  [(f"Both land after {fmt(tf)} s, and B lands {fmt(vx * tf)} m from the base", None),
   ("B lands later, because it has further to travel", "M9"),
   ("B lands sooner, because it is moving faster", "M9"),
   (f"Both land after {fmt(tf)} s, and B lands {fmt(vx)} m from the base", "C0")], correct_at=2)

h, vx = 1.25, 400
tf = math.sqrt(2 * h / G); close(tf, 0.5)
q("Q18", f"A bullet is fired horizontally at {vx} m/s from {fmt(h, 2)} m above flat ground, and another is dropped from the same height at the same moment. Ignore air resistance. Which is right?",
  [(f"Both land after {fmt(tf)} s; the fired one lands {fmt(vx * tf)} m away", None),
   ("The fired bullet stays in the air much longer", "M9"),
   ("The fired bullet flies straight until it slows down, then falls", "M9"),
   (f"Both land after {fmt(tf)} s; the fired one lands {fmt(vx)} m away", "C0")], correct_at=1)

# ---------- M10: velocity is zero at the top ----------
u, ang = 20, 30
vx = u * math.cos(math.radians(ang))
q("Q19", f"A football is kicked at {u} m/s at {ang}° above the horizontal. Ignore air resistance. What is its speed at the highest point?",
  [(f"{fmt(vx)} m/s, moving horizontally", None),
   ("0 m/s, it stops at the top", "M10"),
   (f"{fmt(u * math.sin(math.radians(ang)))} m/s, moving horizontally", "C0"),
   (f"{fmt(u)} m/s, the speed does not change", "C0")], correct_at=3)

vx, vy = 12, 16
assert math.hypot(vx, vy) == 20
q("Q20", f"A stone is thrown with a horizontal velocity of {vx} m/s and an upward velocity of {vy} m/s. At the top of its path, its velocity and acceleration are:",
  [(f"{vx} m/s horizontal, and 10 m/s² downward", None),
   ("Zero velocity, and 10 m/s² downward", "M10"),
   ("Zero velocity, and zero acceleration", "M1"),
   (f"{vx} m/s horizontal, and zero acceleration", "M1")], correct_at=2)


# ======================= Retention set C (Q21 to Q30) =======================
# Taken 3 to 4 days after the post-test. New situations, same ten misconceptions.

u, t = 4.0, 2.0
a = u / t; close(a, 2)
q("Q21", f"A lift moving up at {fmt(u)} m/s slows evenly, stops after {fmt(t)} s, and then starts moving down. At the instant it stops, its acceleration is:",
  [(f"{fmt(a)} m/s² downward", None),
   ("Zero, because it is not moving", "M1"),
   (f"{fmt(a)} m/s² upward", "M3"),
   (f"{fmt(u * t)} m/s² downward", "C0")], correct_at=1)

u, a, t = -8.0, -3.0, 2.0
v = u + a * t; close(v, -14)
q("Q22", f"Taking right as positive, a scooter moving left at {fmt(abs(u))} m/s has an acceleration of −{fmt(abs(a))} m/s². What is its speed after {fmt(t)} s?",
  [(f"{fmt(abs(v))} m/s, it has sped up", None),
   (f"{fmt(abs(u) + a * t)} m/s, the negative acceleration slowed it", "M2"),
   (f"{fmt(abs(v))} m/s, but it has slowed down since −14 is less than −8", "M6"),
   (f"{fmt(abs(u) + abs(a))} m/s, it has sped up", "C0")], correct_at=2)

u, v, t = 20.0, 8.0, 3.0
a = (u - v) / t; close(a, 4)
q("Q23", f"A car moving north at {fmt(u)} m/s slows evenly to {fmt(v)} m/s in {fmt(t)} s. Its acceleration is:",
  [(f"{fmt(a)} m/s² south", None),
   (f"{fmt(a)} m/s² north, the way it is moving", "M3"),
   ("Zero, because it is still moving north", "M3"),
   (f"{fmt(u / t)} m/s² south", "C0")], correct_at=3)

GRAPHS["q24"] = {"xLabel": "t (s)", "yLabel": "v (m/s)", "xMax": 8, "yMax": 16,
                 "lines": [{"points": [[0, 0], [4, 12], [8, 12]]}]}
q("Q24", "The velocity-time graph of a sprinter is shown. Between t = 4 s and t = 8 s, the sprinter:",
  [("Runs at a steady 12 m/s", None),
   ("Runs along a flat stretch of ground", "M4"),
   ("Stands still, because the line is flat", "M5"),
   (f"Speeds up at {fmt(12 / 4)} m/s²", "C0")], graph="q24", correct_at=0)

GRAPHS["q25"] = {"xLabel": "t (s)", "yLabel": "v (m/s)", "xMax": 4, "yMax": 20,
                 "lines": [{"points": [[0, 0], [4, 20]]}]}
acc = 20 / 4; close(acc, 5)
q("Q25", "The velocity-time graph of a motorbike starting from rest is shown. What is its acceleration?",
  [(f"{fmt(acc)} m/s²", None),
   ("20 m/s²", "M5"),
   (f"{fmt(0.5 * 4 * 20)} m/s²", "M5"),
   (f"{fmt(4 / 20)} m/s²", "C0")], graph="q25", correct_at=2)

d, minutes = 3, 10
hours = minutes / 60
q("Q26", f"A car drives {d} km east and then {d} km back west to where it started, taking {minutes} minutes in total. Find its average speed and average velocity.",
  [(f"{fmt(2 * d / hours)} km/h and 0", None),
   (f"{fmt(2 * d / hours)} km/h and {fmt(2 * d / hours)} km/h", "M6"),
   ("0 and 0", "M6"),
   (f"{fmt(d / hours)} km/h and 0", "C0")], correct_at=1)

s, v1, v2 = 120, 40, 120
avg = 2 * s / (s / v1 + s / v2); close(avg, 60)
q("Q27", f"A train covers {s} km at {v1} km/h and then another {s} km at {v2} km/h. What is its average speed for the whole journey?",
  [(f"{fmt(avg)} km/h", None),
   (f"{fmt((v1 + v2) / 2)} km/h", "M7"),
   (f"{fmt(v1 + v2)} km/h", "C0"),
   (f"{fmt(v1)} km/h", "C0")], correct_at=3)

h = 80
tf = math.sqrt(2 * h / G); close(tf, 4)
q("Q28", f"A 0.16 kg cricket ball and a 7 kg shot put are dropped together from {h} m. Ignore air resistance. When does each land?",
  [(f"Both land after {fmt(tf)} s", None),
   ("The shot put lands first, well ahead of the ball", "M8"),
   ("The shot put lands first, but only just", "M8"),
   (f"Both land after {fmt(h / G)} s", "C0")], correct_at=0)

h, va, vb = 0.8, 1.0, 3.0
tf = math.sqrt(2 * h / G); close(tf, 0.4)
q("Q29", f"Two marbles roll off a table {fmt(h)} m high at the same moment, one at {fmt(va)} m/s and one at {fmt(vb)} m/s. Ignore air resistance. Which is right?",
  [(f"Both land after {fmt(tf)} s, {fmt(va * tf)} m and {fmt(vb * tf)} m from the table", None),
   ("The faster marble takes longer to land", "M9"),
   ("The faster marble lands sooner", "M9"),
   (f"Both land after {fmt(tf)} s, {fmt(va)} m and {fmt(vb)} m from the table", "C0")], correct_at=2)

u = 30
vx = u * 0.6; close(vx, 18)
q("Q30", f"A ball is thrown at {u} m/s at an angle where cos θ = 0.6 and sin θ = 0.8. Ignore air resistance. What is its speed at the highest point?",
  [(f"{fmt(vx)} m/s, moving horizontally", None),
   ("0 m/s, it stops at the top", "M10"),
   (f"{fmt(u * 0.8)} m/s, moving horizontally", "C0"),
   (f"{fmt(u)} m/s, the speed does not change", "C0")], correct_at=1)

# ---------- every value a graph question needs must sit on a grid line ----------
def on_grid(g, x, y):
    return abs((x / (g["xMax"] / 4)) - round(x / (g["xMax"] / 4))) < 1e-9 and abs((y / (g["yMax"] / 4)) - round(y / (g["yMax"] / 4))) < 1e-9
for name, needed in {"q7": [(10, 0)], "q8": [(4, 10), (8, 0)], "q9": [(6, 18)], "q10": [(0, 10), (5, 40)], "q24": [(4, 12), (8, 12)], "q25": [(4, 20)]}.items():
    for x, y in needed:
        assert on_grid(GRAPHS[name], x, y), (name, x, y)
        assert any(abs(px - x) < 1e-9 and abs(py - y) < 1e-9 for px, py in GRAPHS[name]["lines"][0]["points"]), (name, x, y)

# ---------- assemble ----------
A = [f"Q{i}" for i in range(1, 21, 2)]
B = [f"Q{i}" for i in range(2, 21, 2)]
C = [f"Q{i}" for i in range(21, 31)]
for name, s in (("A", A), ("B", B), ("C", C)):
    codes = {t for qid in s for t in Q[qid]["tags"] if t and t != "C0"}
    assert codes == {f"M{i}" for i in range(1, 11)}, (name, codes)
letters = [Q[qid]["tags"].index(None) for qid in A + B + C]
print("correct letters A..D counts:", [letters.count(i) for i in range(4)])
pack = {
    "id": "KIN-02",
    "title": "Kinematics",
    "conventions": base["conventions"],
    "misconceptions": base["misconceptions"],
    "graphs": GRAPHS,
    "questions": Q,
    "sets": {"A_pre": A, "B_post": B, "C_retention": C},
    "foundations": base["foundations"],
}
json.dump(pack, open(sys.argv[2], "w"), ensure_ascii=False, indent=2)
print("wrote", sys.argv[2])
