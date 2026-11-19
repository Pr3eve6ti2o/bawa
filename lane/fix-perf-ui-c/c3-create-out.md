1. `import { Check } from "lucide-react";`

> ```text
>         <CardContent>
>           <ol aria-label="Wallet creation steps" className="space-y-5">
> ```

```tsx
        <CardContent>
          <ol aria-label="Creation progress" className="mb-3 flex items-center">
            {([1, 2, 3, 4] as const).map((progressStep) => (
              <li
                key={progressStep}
                aria-current={progressStep === step ? "step" : undefined}
                className="flex flex-1 items-center last:flex-none"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-body-md ${
                    progressStep < step
                      ? "bg-success text-primary-foreground"
                      : progressStep === step
                        ? "bg-primary font-bold text-primary-foreground"
                        : "bg-surface-blue-dim text-primary"
                  }`}
                >
                  {progressStep < step ? (
                    <>
                      <Check aria-hidden="true" className="size-5" />
                      <span className="sr-only">{progressStep}</span>
                    </>
                  ) : (
                    progressStep
                  )}
                </span>
                {progressStep < 4 && (
                  <span
                    aria-hidden="true"
                    className="mx-2 h-0.5 flex-1 bg-progress-track"
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="mb-5 text-body-sm font-medium text-foreground">
            Step {step} of 4:{" "}
            {
              {
                1: "Set a vault password",
                2: "Write down 24 words",
                3: "Confirm 3 words",
                4: "Wallet ready",
              }[step]
            }
          </p>
          <ol aria-label="Wallet creation steps" className="space-y-5">
```

2.

> ```text
>             <ol aria-label="Recovery phrase" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
>               {words.map((word, index) => (
>                 <li
>                   key={index}
>                   className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
>                 >
>                   <span className="font-semibold text-muted-foreground">{index + 1}.</span>
>                   <span>{word}</span>
>                 </li>
>               ))}
>             </ol>
> ```

```tsx
            <ol aria-label="Recovery phrase" className="grid grid-cols-3 gap-2">
              {words.map((word, index) => (
                <li
                  key={index}
                  className="flex h-12 items-center gap-2 rounded-md border bg-card px-3"
                >
                  <span className="text-body-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="text-body-md font-semibold">{word}</span>
                </li>
              ))}
            </ol>
```