# Lab 5.1.2 – מ־Plain Manifests ל־Helm Chart: fullnameOverride, Sync, ו־Immutable Fields (חלק ב׳)

> חלק ב׳ מתוך מעבדה 5.1. ממשיך ישירות מ־[מעבדה 5.1.1](../5.1.1/solution.md), שם ה־Application
> `guestbook` הושאר במצב `OutOfSync` עם ארבעה משאבים (שניים חדשים שנוצרו מ־Helm Chart, שניים
> ישנים המסומנים למחיקה), אחרי מעבר `source.path` מ־`guestbook` ל־`helm-guestbook` ללא
> `fullnameOverride`.
> חלק ג׳ (`valueFiles`, `values.yaml` מול `values-production.yaml`, וסיכום המעבדה)
> יגיע במעבדה נפרדת (5.1.3).

---

# חלק 8: מדוע Argo CD רוצה ליצור משאבים חדשים?

## הסבר

לאחר המעבר ל־Helm Chart, ייתכן שתשימו לב ש־Argo CD אינו מתכנן לעדכן את המשאבים הקיימים, אלא ליצור חדשים ולמחוק את הישנים.

בשלב זה נבין מדוע התנהגות זו מתרחשת.

---

## Validation

ב־Web UI לחצו על אחד מהמשאבים החדשים.

לאחר מכן עברו ללשונית:

```
Desired Manifest
```

או דרך ה־CLI, ניתן לחשב מראש את ה־Tracking ID הצפוי למשאב החדש לפי אותה נוסחה שראינו
ב־[חלק 4](../5.1.1/solution.md):

```
guestbook:apps/Deployment:default/guestbook-helm-guestbook
```

---

## תוצאה צפויה

ב־Manifest יופיע Tracking ID חדש.

---

## השוואה

פתחו גם את המשאב הישן ועברו ללשונית:

```
Live Manifest
```

או:

```bash
kubectl get deploy guestbook-ui -n default \
  -o jsonpath='{.metadata.annotations.argocd\.argoproj\.io/tracking-id}'
```

---

## תוצאה צפויה

תופיע Annotation דומה ל־ (אומת בפועל מול הקלאסטר):

```
guestbook:apps/Deployment:default/guestbook-ui
```

לעומת המשאב החדש, שבו שם המשאב שונה (`guestbook-helm-guestbook` במקום `guestbook-ui`).

---

## הסבר התנהגות

Argo CD עוקב אחר המשאבים באמצעות ה־Tracking ID.

כאשר שם המשאב משתנה, גם ה־Tracking ID משתנה.

מבחינת Argo CD מדובר במשאב חדש לחלוטין, ולכן הוא מתכנן:

- ליצור את המשאב החדש
- למחוק את המשאב הישן (אם Prune מופעל)

למרות שבפועל מדובר באותה אפליקציה.

---

# חלק 9: מדוע השתנו שמות המשאבים?

## הסבר

כעת נבדוק מה גורם לשינוי בשם ה־Deployment וה־Service.

פתחו את הקובץ:

```
templates/service.yaml
```

---

## תוצאה צפויה

שם המשאב לא יהיה כתוב בצורה מפורשת, אלא באמצעות Template (אומת מול ה־Chart בפועל):

```yaml
metadata:
  name: {{ template "helm-guestbook.fullname" . }}
```

> הערה: בגרסת ה־Chart בפועל בשימוש כאן נעשה שימוש בתחביר `{{ template "..." . }}`
> ולא ב־`{{ include "..." . }}` — שני התחבירים שקולים מבחינה תפקודית (`include`
> מאפשר בנוסף Piping לפונקציות נוספות כמו `indent`, מה שהתחביר `template` אינו תומך בו),
> אך ייתכן הבדל בין גרסאות Chart שונות.

---

## Validation

פתחו את הקובץ:

```
templates/_helpers.tpl
```

---

## הסבר התנהגות

פונקציית `fullname` אחראית לייצר את שם המשאב:

```gotemplate
{{- define "helm-guestbook.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}
```

כברירת מחדל היא משלבת:

- Release Name (=`guestbook`, שם ה־Application)
- Chart Name (=`helm-guestbook`)

מכיוון ש־`guestbook` (Release Name) אינו מכיל את `helm-guestbook` (Chart Name), הפונקציה
נופלת ל־`printf "%s-%s" .Release.Name $name`, ומייצרת:

```
guestbook-helm-guestbook
```

לכן Helm מייצר שמות שונים מאלו שהיו קיימים ב־Plain Kubernetes Manifests.

---

# חלק 10: שימוש ב־fullnameOverride

## הסבר

כדי לשמור על אותם שמות של המשאבים, ניתן להשתמש ב־`fullnameOverride`.

ערך זה מאפשר לדרוס את השם ש־Helm מייצר — הוא הענף **הראשון** שנבדק בפונקציית `fullname`
לעיל (`{{- if .Values.fullnameOverride -}}`), ולכן גובר על כל שאר הלוגיקה.

---

## עדכון ה־Application

הוסיפו תחת `spec.source` את ההגדרה הבאה:

```diff
  source:
    repoURL: https://github.com/LironeFitoussi/argocd-example-apps-labs.git
    targetRevision: HEAD
    path: helm-guestbook
+
+   helm:
+     values: |
+       fullnameOverride: guestbook-ui
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

## הסבר התנהגות

השדה `values` מאפשר להעביר ערכים ל־Helm Chart ישירות מתוך ה־Application Manifest.

מבחינת Helm, ערכים אלו שקולים לקובץ `values.yaml`.

אפשר לחשוב עליהם כעל **Inline Values File**.

---

# חלק 11: בדיקת ה־Diff לאחר fullnameOverride

## הסבר

לאחר החלת השינוי נבדוק כיצד השתנתה תוכנית הסנכרון.

---

## Validation

ב־Web UI:

1. בצעו Refresh.
2. פתחו את ה־Application.
3. לחצו על **Diff**.

או דרך kubectl:

```bash
kubectl get application guestbook -n argocd \
  -o jsonpath='{range .status.resources[*]}{.kind}{"\t"}{.name}{"\t"}{.status}{"\n"}{end}'
```

---

## תוצאה צפויה

בניגוד למצב הקודם (אומת בפועל — כעת רק שני משאבים, לא ארבעה):

```
Service      guestbook-ui   OutOfSync
Deployment   guestbook-ui   OutOfSync
```

- המשאבים הישנים כבר אינם מסומנים למחיקה.
- Argo CD מצליח להתאים בין המשאבים הקיימים לבין המשאבים שנוצרים מה־Helm Chart.

יופיעו רק מספר שינויים קטנים במניפסטים, כגון:

- Labels (`chart`, `release`, `heritage` — התוספות הסטנדרטיות של Helm)
- Ports (שם ה־Port הופך ל־`http` במקום Port ללא שם)
- Metadata

---

## הסבר התנהגות

לאחר שהשמות חזרו להיות זהים, גם ה־Tracking IDs תואמים.

כתוצאה מכך Argo CD מבין שמדובר באותם משאבים, ולכן הוא יכול לבצע **Update** במקום **Delete + Create**.

מעבר זה מאפשר מעבר חלק יותר מ־Plain Kubernetes Manifests ל־Helm Chart.

---

# חלק 12: ביצוע Sync

## הסבר

כעת נבצע Synchronization של האפליקציה.

---

## שלבים

1. לחצו על **Sync**.
2. אשרו באמצעות **Synchronize**.

או דרך ה־CLI, ללא אפשרויות מיוחדות:

```bash
kubectl patch application guestbook -n argocd --type merge \
  -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"syncStrategy": {"hook": {}}}}}'
```

---

## תוצאה צפויה

ה־Service יסונכרן בהצלחה.

עם זאת, ה־Deployment נכשל (אומת בפועל):

```
Service      Synced       service/guestbook-ui configured
Deployment   SyncFailed   error when patching "...": spec.selector: field is immutable
```

---

## הסבר התנהגות

בשלב זה Argo CD מצליח לזהות את אותו Deployment, ולכן הוא מנסה **לעדכן** אותו במקום ליצור Deployment חדש.

אולם חלק מהשדות ב־Deployment אינם ניתנים לשינוי לאחר יצירת המשאב.

---

# חלק 13: Immutable Fields

## הסבר

פתחו את פרטי השגיאה של ה־Deployment.

---

## תוצאה צפויה

תופיע הודעה הדומה ל־ (אומת בפועל, הודעת שגיאה מלאה):

```
Deployment.apps "guestbook-ui" is invalid: spec.selector: Invalid value:
{"matchLabels":{"app":"helm-guestbook","release":"guestbook"}}: field is immutable
```

---

## הסבר התנהגות

השדה:

```yaml
spec.selector.matchLabels
```

הוא **Immutable Field**.

לאחר יצירת Deployment, Kubernetes אינו מאפשר לשנות אותו.

מסיבה זו פעולת ה־Update נכשלת, למרות שה־Manifest עצמו תקין. הסיבה לכך שהוא בכלל השתנה:
תבנית ה־Chart (`templates/deployment.yaml`) בונה את ה־Selector מ־`helm-guestbook.name`
(=`helm-guestbook`, שם ה־Chart) ו־`.Release.Name` (=`guestbook`), בעוד שה־Deployment
המקורי (Plain Manifest) השתמש בערכים אחרים לגמרי ב־Selector שלו.

---

# חלק 14: שימוש ב־Replace וב־Force

## הסבר

כאשר Kubernetes אינו מאפשר לעדכן משאב, ניתן להורות ל־Argo CD להחליף אותו.

---

## שלבים

בחלון ה־Sync:

סמנו:

- ✅ Replace
- ✅ Force

לאחר מכן לחצו:

```
Synchronize
```

או דרך ה־CLI:

```bash
kubectl patch application guestbook -n argocd --type merge \
  -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"syncStrategy": {"apply": {"force": true}}, "syncOptions": ["Replace=true"]}}}'
```

---

## תוצאה צפויה

ה־Deployment ייווצר מחדש בהצלחה (אומת בפועל):

```
Service      Synced   service "guestbook-ui" deleted from default namespace / service/guestbook-ui replaced
Deployment   Synced   deployment.apps "guestbook-ui" deleted from default namespace / deployment.apps/guestbook-ui replaced
```

לאחר מספר שניות מצב האפליקציה יחזור ל־:

```
Synced
Healthy
```

(אומת בפועל: `guestbook   Synced   Healthy`)

---

## הסבר התנהגות

במצב רגיל Argo CD משתמש ב־`kubectl apply`.

כאשר מסמנים **Replace**, Argo CD משתמש ב־`kubectl replace` (מחיקה ויצירה מחדש בפועל,
כפי שרואים בהודעות למעלה — `deleted` ואז `replaced`), במקום לנסות לעדכן אותו.

אפשרות **Force** מאפשרת לבצע פעולות שעלולות להיות הרסניות יותר, ולכן יש להשתמש בה בזהירות ורק כאשר יש צורך.

במקרה זה היא מאפשרת להתגבר על מגבלת ה־Immutable Fields ולהשלים את המעבר ל־Helm Chart.

---

## מצב סופי של חלק ב׳ (`guestbook-app.yaml`)

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

  destination:
    server: https://kubernetes.default.svc
    namespace: default
```

```bash
kubectl get application guestbook -n argocd
kubectl get deploy,svc -n default
```

```
NAME        SYNC STATUS   HEALTH STATUS
guestbook   Synced        Healthy

NAME                            READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/guestbook-ui    1/1     1            1           7s

NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
service/guestbook-ui   ClusterIP   10.102.194.219   <none>        80/TCP    7s
```

---

**בחלק ג׳ (מעבדה 5.1.3)** נסיים את המעבדה עם:

- עבודה עם `valueFiles`
- ההבדל בין `values.yaml` ל־`values-production.yaml`
- מדוע `values.yaml` אינו חייב להיות מוגדר במפורש
- הדגמת `values-production.yaml` והשפעתו על ה־Diff
- סיכום המעבדה ונקודות המפתח.
