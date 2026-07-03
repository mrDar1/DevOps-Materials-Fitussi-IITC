# Lab 5.1.1 – מ־Plain Manifests ל־Helm Chart: Fork, Tracking, ו־Prune (חלק א׳)

> חלק א׳ מתוך מעבדה 5.1. ממשיך ישירות מ־[מעבדה 4.2](../../4%20-%20ArgoCD%20Architecture/4.2/solution.md),
> שם ה־Application `guestbook` כבר מוגדר מול ה־Fork האישי ופרוס מ־Plain Kubernetes Manifests.
> חלק ב׳ (פתרון ה־Tracking ID, `fullnameOverride`, `values`/`valueFiles`, ו־`Replace`+`Force`)
> יגיע במעבדה נפרדת (5.1.2).

---

# 🎯 Objectives

במעבדה זו נבצע:

* יצירת Fork ל־Repository של Argo CD Example Apps
* עדכון Application כך שיצביע ל־Fork האישי
* הבנת אופן זיהוי המשאבים על ידי Argo CD
* מעבר מ־Plain Kubernetes Manifests ל־Helm Chart
* הבנת השפעת שינוי שמות המשאבים על תהליך ה־Sync
* שימוש ב־Helm Values בתוך Argo CD

---

# חלק 1: אימות מצב הסביבה

## הסבר

לפני תחילת המעבדה נוודא שה־Guestbook Application כבר קיים ופועל.

המעבדה מניחה שהשלמתם את המעבדה הקודמת, שבה פרסנו את Guestbook באמצעות Kubernetes Manifests רגילים.

---

## בדיקת ה־Deployment

```bash
kubectl get deployment
```

## בדיקת ה־Application

```bash
kubectl get applications -n argocd
```

---

## תוצאה צפויה

יופיעו:

* Deployment בשם `guestbook-ui`
* Application בשם `guestbook`

כאשר מצב האפליקציה הוא:

```
Synced
Healthy
```

---

## Validation

אם האפליקציה אינה קיימת או נמצאת במצב `OutOfSync`, יש לבצע Sync לפני המשך המעבדה.

---

# חלק 2: יצירת Fork של Repository

## הסבר

במעבדה זו נרצה לבצע שינויים ב־Repository.

מכיוון שאין לנו הרשאות כתיבה ל־Repository המקורי, כל תלמיד יעבוד על Fork אישי.

---

## שלבים

1. פתחו את Repository של Argo CD Example Apps.
2. לחצו על **Fork**.
3. אשרו את יצירת ה־Fork.
4. המתינו עד לסיום התהליך.

ניתן לבצע זאת גם דרך GitHub CLI במקום כפתור ה־Fork בממשק:

```bash
gh repo fork argoproj/argocd-example-apps --fork-name argocd-example-apps-labs --clone=false
```

---

## תוצאה צפויה

Repository חדש ייווצר תחת חשבון GitHub שלכם.

בהמשך למעבדות הקודמות, ה־Fork המשמש בפועל לאורך כל הסדרה הוא:
`https://github.com/LironeFitoussi/argocd-example-apps-labs.git`.

---

## הסבר התנהגות

ה־Fork הוא עותק מלא של ה־Repository המקורי.

כל שינוי שתבצעו יתבצע על המאגר שלכם בלבד, מבלי להשפיע על המאגר המקורי.

---

# חלק 3: עדכון ה־Application ל־Fork החדש

## הסבר

כעת נעדכן את Application כך שיקרא את ה־Manifests מתוך ה־Fork האישי.

פתחו את הקובץ:

```
guestbook-app.yaml
```

ועדכנו את הערך:

```yaml
repoURL: https://github.com/<YOUR_USERNAME>/argocd-example-apps.git
```

> במעבדה זו בפועל השדה כבר מצביע על `https://github.com/LironeFitoussi/argocd-example-apps-labs.git`
> (הוגדר במעבדה 4.2) — אין צורך לשנות אותו שוב כאן, רק לזכור שזהו אותו עיקרון.

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

---

## Validation

בדקו את ה־Application:

```bash
kubectl describe application guestbook -n argocd
```

---

## תוצאה צפויה

בשדה:

```
Repository URL
```

יופיע ה־Fork האישי שלכם.

---

## הסבר התנהגות

Argo CD אינו "מחובר" ל־Repository מסוים.

הוא פשוט קורא את ה־Repository שמוגדר בתוך ה־Application.

ניתן להחליף Repository בכל רגע, ובסנכרון הבא Argo CD ישווה את תוכן המאגר החדש למצב הקיים בקלאסטר.

---

# חלק 4: כיצד Argo CD מזהה את המשאבים שלו

## הסבר

לאחר החלפת ה־Repository ייתכן שתעלה השאלה:

**כיצד Argo CD יודע אילו Deployments או Services שייכים ל־Application מסוים?**

התשובה היא באמצעות מנגנון **Resource Tracking**.

---

## Validation

ב־Web UI:

1. פתחו את ה־Deployment.
2. עברו ללשונית **Live Manifest**.

או ישירות דרך kubectl:

```bash
kubectl get deploy guestbook-ui -n default \
  -o jsonpath='{.metadata.annotations.argocd\.argoproj\.io/tracking-id}'
```

---

## תוצאה צפויה

יופיע Annotation בסגנון הבא:

```
guestbook:apps/Deployment:default/guestbook-ui
```

(אומת בפועל מול הקלאסטר). לשם השוואה, ל־Service המקביל יש Annotation דומה אך עם
API Group ריק (מאחר וה־Service שייך ל־Core API, ללא Group):

```
guestbook:/Service:default/guestbook-ui
```

---

## הסבר התנהגות

כאשר Argo CD יוצר או מנהל משאב, הוא מוסיף אליו Annotation בשם:

```text
argocd.argoproj.io/tracking-id
```

Annotation זה בנוי מהתבנית `<App>:<Group>/<Kind>:<Namespace>/<Name>`, ומכיל:

* שם ה־Application
* Group וסוג המשאב (Kind)
* Namespace
* שם המשאב

באמצעותו Argo CD יודע:

* אילו משאבים שייכים לכל Application.
* אילו משאבים עליו לעדכן.
* אילו משאבים אינם מנוהלים על ידו.

חשוב לזכור: השם (`Name`) הוא חלק בלתי נפרד מה־ID הזה. זו נקודה שתהיה קריטית
בהמשך (ראו חלק 6), כי Helm Chart עשוי לייצר שם משאב שונה מהמניפסט המקורי.

---

# חלק 5: סקירת Helm Chart

## הסבר

בשלב זה נעבור מה־Kubernetes Manifests הרגילים לגרסת Helm של אותה אפליקציה.

פתחו את התיקייה:

```
helm-guestbook/
```

---

## תוצאה צפויה

התיקייה מכילה את המבנה הסטנדרטי של Helm Chart (אומת מול ה־Fork בפועל):

```
helm-guestbook/
├── Chart.yaml
├── values.yaml
├── values-production.yaml
├── custom-values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── _helpers.tpl
    └── NOTES.txt
```

---

## הסבר התנהגות

בדומה לכל Helm Chart, גם כאן:

* `Chart.yaml` מתאר את ה־Chart (שם, גרסה, `apiVersion: v2`).
* `templates/` מכיל את תבניות Kubernetes.
* `values.yaml` מכיל את ערכי ברירת המחדל (`replicaCount: 1`, `service.type: ClusterIP` וכו׳).
* `_helpers.tpl` מכיל פונקציות Template המשמשות לבניית שמות, Labels וערכים נוספים — ובפרט
  את `helm-guestbook.fullname`, שקובע את שם המשאבים המיוצרים (ראו חלק 6).

למרות התחביר השונה, בסופו של דבר Helm מייצר Kubernetes Manifests רגילים ש־Argo CD יודע לנהל
(Argo CD למעשה מריץ `helm template` מאחורי הקלעים ומשווה את הפלט לקלאסטר, בדיוק כמו כל מקור אחר).

---

# חלק 6: מעבר מ־Guestbook ל־Helm Guestbook

## הסבר

כעת נעדכן את ה־Application כך שישתמש ב־Helm Chart במקום ב־Manifests הרגילים.

שנו את השדה:

```yaml
path: guestbook
```

ל־

```yaml
path: helm-guestbook
```

---

## החלת השינוי

```bash
kubectl apply -f guestbook-app.yaml
```

---

## תוצאה צפויה

ה־Application יעבור למצב:

```
OutOfSync
```

(אומת בפועל: `guestbook   OutOfSync   Healthy`)

---

## Validation

פתחו את ה־Application ב־Web UI, או:

```bash
kubectl get application guestbook -n argocd \
  -o jsonpath='{range .status.resources[*]}{.kind}{"\t"}{.name}{"\t"}{.status}{"\n"}{end}'
```

---

## תוצאה צפויה

יופיעו ארבעה משאבים (אומת בפועל):

```
Service      guestbook-helm-guestbook   OutOfSync   ← חדש
Service      guestbook-ui               OutOfSync   ← ישן, מסומן למחיקה
Deployment   guestbook-helm-guestbook   OutOfSync   ← חדש
Deployment   guestbook-ui               OutOfSync   ← ישן, מסומן למחיקה
```

* Service חדש
* Deployment חדש
* Service ישן שמסומן למחיקה
* Deployment ישן שמסומן למחיקה

---

## הסבר התנהגות

למרות שמדובר באותה אפליקציה, Helm מייצר שמות שונים למשאבים.

הסיבה הטכנית המדויקת: `.Release.Name` (=`guestbook`, שם ה־Application) אינו מכיל את
`.Chart.Name` (=`helm-guestbook`), ולכן הפונקציה `helm-guestbook.fullname` ב־`_helpers.tpl`
נופלת ל־`printf "%s-%s" .Release.Name $name`, שמייצרת את השם `guestbook-helm-guestbook`.

מכיוון שהשמות השתנו, גם ה־Tracking ID השתנה (ראו חלק 4) — ו־Argo CD מתייחס אליהם כאל
משאבים חדשים לגמרי, לא כעדכון של הקיימים.

במקביל, הוא מזהה שהמשאבים הישנים (`guestbook-ui`) כבר אינם מופיעים במקור (Git Repository),
ולכן מסמן אותם כמועמדים למחיקה במהלך ה־Sync.

---

# חלק 7: הבנת פעולת Prune

## הסבר

בעת ביצוע Sync יופיע בפניכם המושג **Prune**.

אפשרות זו קובעת האם Argo CD ימחק משאבים שכבר אינם קיימים ב־Git.

---

## הסבר התנהגות

אם **Prune אינו מסומן**:

* המשאבים החדשים יווצרו.
* המשאבים הישנים יישארו בקלאסטר.
* ייתכן שיידרש ניקוי ידני לאחר מכן.

אם **Prune מסומן**:

* Argo CD ימחק את המשאבים שאינם קיימים עוד ב־Repository.
* הקלאסטר יישאר מסונכרן לחלוטין עם מצב ה־Git.

במעבר מ־Plain Kubernetes Manifests ל־Helm Charts, שימוש ב־Prune מסייע למנוע השארת משאבים ישנים שאינם מנוהלים עוד.

> **חשוב:** בשלב זה **לא** מבצעים Sync/Prune עדיין. המצב הנוכחי של הקלאסטר בסוף חלק א׳
> הוא `OutOfSync` עם ארבעה משאבים — זו נקודת ההתחלה של מעבדה 5.1.2, שם נפתור את בעיית
> ה־Tracking ID (באמצעות `fullnameOverride`) לפני שמבצעים Sync בפועל.

---

## מצב סופי של חלק א׳ (`guestbook-app.yaml`)

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

  destination:
    server: https://kubernetes.default.svc
    namespace: default
```

```bash
kubectl get application guestbook -n argocd
```

```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   OutOfSync     Healthy
```

---

**בחלק ב׳ (מעבדה 5.1.2)** נמשיך עם:

* פתרון בעיית שינוי ה־Tracking IDs.
* שימוש ב־`fullnameOverride`.
* `values` object.
* `valueFiles`.
* כשל ה־Deployment בגלל Immutable Fields.
* `Replace` ו־`Force`.
* ההבדל בין `values.yaml` ל־`values-production.yaml`.
* סיום המעבדה וסיכום הנקודות החשובות.
