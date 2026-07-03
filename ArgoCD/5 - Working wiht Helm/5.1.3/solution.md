# Lab 5.1.3 – valueFiles, values.yaml מול values-production.yaml, וסיכום (חלק ג׳)

> חלק ג׳ ואחרון מתוך מעבדה 5.1. ממשיך ישירות מ־[מעבדה 5.1.2](../5.1.2/solution.md), שם
> ה־Application `guestbook` הגיע למצב `Synced`/`Healthy` על ה־Helm Chart (`helm-guestbook`)
> עם `helm.values: fullnameOverride: guestbook-ui`, לאחר Sync עם **Replace**+**Force**.

---

# חלק 15: שימוש ב־Value Files

## הסבר

עד כה השתמשנו בשדה:

```yaml
helm:
  values: |
```

כדי להעביר ערכים ל־Helm Chart.

דרך נוספת, ונפוצה יותר בפרויקטים אמיתיים, היא להשתמש בקובצי Values.

---

## הסבר התנהגות

כאשר משתמשים ב־Value Files, Argo CD קורא את קובץ הערכים מתוך ה־Repository ומעביר אותו ל־Helm בזמן יצירת ה־Manifests.

גישה זו מתאימה כאשר קיימים מספר קובצי קונפיגורציה, לדוגמה:

- Development
- Staging
- Production

---

# חלק 16: היכן נמצאים קובצי ה־Values

## הסבר

פתחו את תיקיית ה־Helm Chart.

---

## Validation

ודאו שקיימים הקבצים:

```
helm-guestbook/
├── values.yaml
└── values-production.yaml
```

---

## תוצאה צפויה

יופיעו לפחות שני קובצי Values (אומת מול ה־Fork בפועל — קיים גם `custom-values.yaml` נוסף,
שאינו בשימוש בחלק זה של המעבדה).

---

## הסבר התנהגות

חשוב שקובצי ה־Values יהיו חלק מה־Repository.

Argo CD אינו יודע לקרוא קבצים מקומיים מהמחשב שלכם — ה־repo-server של Argo CD משכפל את
ה־Repository בעצמו ומחפש את הקבצים תחת `spec.source.path` (`helm-guestbook/`), ולכן
כל קובץ המוזכר תחת `valueFiles` חייב לשבת שם.

---

# חלק 17: הגדרת Value File בתוך Application

## הסבר

כעת נגדיר ל־Argo CD להשתמש בקובץ Values מסוים.

עדכנו את ה־Application:

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values.yaml
```

---

## החלת השינוי

```bash
kubectl apply -f guestbook-app.yaml
```

---

## תוצאה צפויה

```
application.argoproj.io/guestbook configured
```

(אומת בפועל)

---

## Validation

בצעו Refresh ב־Application.

---

## תוצאה צפויה

לא אמורים להופיע שינויים חדשים.

האפליקציה תישאר (אומת בפועל):

```
Synced
Healthy
```

---

## הסבר התנהגות

למעשה, Helm כבר משתמש ב־`values.yaml` כברירת מחדל.

לכן הוספתו בצורה מפורשת אינה משנה את תוצאת ה־Rendering.

זוהי בעיקר דרך מפורשת להראות באיזה קובץ Values משתמשים.

---

# חלק 18: מעבר ל־values-production.yaml

## הסבר

כעת נחליף את קובץ ה־Values.

עדכנו את ה־Application:

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values-production.yaml
```

---

## החלת השינוי

```bash
kubectl apply -f guestbook-app.yaml
```

---

## Validation

בצעו Refresh ב־Argo CD.

---

## תוצאה צפויה

מצב האפליקציה יעבור ל־ (אומת בפועל):

```
OutOfSync
```

ברמת המשאבים הבודדים, רק ה־Service מסומן כ־OutOfSync — ה־Deployment נשאר Synced,
מכיוון ש־`values-production.yaml` (`service: {type: LoadBalancer}`) משפיע רק על שדה
שנמצא ב־Template של ה־Service:

```
Service      guestbook-ui   OutOfSync
Deployment   guestbook-ui   Synced
```

---

# חלק 19: בדיקת ה־Diff

## הסבר

פתחו את חלון ה־Diff כדי להבין מה השתנה.

---

## Validation

לחצו על:

```
Diff
```

---

## תוצאה צפויה

יופיע שינוי בין (אומת בפועל — Live מול Desired):

```yaml
# Live (בקלאסטר):
type: ClusterIP

# Desired (מרונדר מ־values-production.yaml):
type: LoadBalancer
```

---

## הסבר התנהגות

קובץ `values-production.yaml` מגדיר ערכים שונים מ־`values.yaml`:

```yaml
# values-production.yaml (תוכן מלא)
service:
  type: LoadBalancer
```

במקרה זה, סוג ה־Service משתנה מ־ClusterIP ל־LoadBalancer.

Argo CD מזהה שה־Manifest שנוצר מה־Helm Chart השתנה, ולכן מסמן את האפליקציה כ־OutOfSync.

---

# חלק 20: החזרת ערכי ברירת המחדל

## הסבר

לצורך המשך הקורס נחזור להשתמש ב־`values.yaml`.

עדכנו שוב:

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values.yaml
```

---

## החלת השינוי

```bash
kubectl apply -f guestbook-app.yaml
```

---

## Validation

בצעו Refresh ב־Application.

---

## תוצאה צפויה

מצב האפליקציה יחזור להיות (אומת בפועל):

```
Synced
Healthy
```

```bash
kubectl get svc guestbook-ui -n default -o jsonpath='{.spec.type}'
```

```
ClusterIP
```

---

## הסבר התנהגות

מאחר שחזרנו לקובץ הערכים המקורי, גם ה־Manifest שנוצר על ידי Helm חוזר למצבו הקודם.

כתוצאה מכך, אין עוד הבדל בין מצב ה־Git לבין מצב הקלאסטר.

---

## מצב סופי של המעבדה (`guestbook-app.yaml`)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default

  source:
    repoURL: https://github.com/LironeFitoussi/argocd-example-apps-labs.git
    targetRevision: HEAD
    path: helm-guestbook

    helm:
      values: |
        fullnameOverride: guestbook-ui
      valueFiles:
        - values.yaml

  destination:
    server: https://kubernetes.default.svc
    namespace: default
```

```bash
kubectl get application guestbook -n argocd
```

```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy
```

---

# סיכום נקודות מפתח

- Argo CD יודע לנהל Helm Charts בדיוק כפי שהוא מנהל Kubernetes Manifests רגילים.
- שינוי הנתיב (`path`) מ־`guestbook` ל־`helm-guestbook` גורם ל־Argo CD לעבור לעבודה מול Helm Chart.
- שינוי שמות המשאבים גורם לשינוי ב־Tracking IDs, ולכן Argo CD עשוי לזהות אותם כמשאבים חדשים.
- שימוש ב־`fullnameOverride` מאפשר לשמור על שמות המשאבים ולהקל על המעבר מ־Plain Manifests ל־Helm.
- ניתן להעביר ערכים ל־Helm באמצעות `values` (Inline Values) או באמצעות `valueFiles`.
- `values.yaml` נטען כברירת מחדל על ידי Helm, ולכן אין חובה להגדיר אותו במפורש.
- קובצי Values שונים מאפשרים לנהל תצורות שונות (כגון Development ו־Production) מתוך אותו Helm Chart.
- `Prune` מוחק משאבים שכבר אינם קיימים ב־Git.
- `Replace` ו־`Force` מסייעים להתמודד עם משאבים המכילים שדות בלתי ניתנים לשינוי (Immutable Fields), אך יש להשתמש בהם בזהירות מאחר שהם עלולים לגרום ליצירה מחדש של משאבים.

---

## מבנה המעבדה המלאה

| חלק | תוכן | קובץ |
|---|---|---|
| א׳ | Fork, Resource Tracking, מעבר ל־Helm Chart, Prune | [5.1.1](../5.1.1/solution.md) |
| ב׳ | `fullnameOverride`, Sync, Immutable Fields, Replace+Force | [5.1.2](../5.1.2/solution.md) |
| ג׳ | `valueFiles`, `values.yaml` מול `values-production.yaml`, סיכום | 5.1.3 (מסמך זה) |
