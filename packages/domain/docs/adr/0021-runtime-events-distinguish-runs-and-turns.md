# Runtime events distinguish runs and turns

Gravity will model **Run** and **Turn** as distinct runtime concepts in the canonical **Runtime Event** contract. **Runs** are Gravity's bounded execution records with status, result, activity, and trace projections, while **Turns** are runtime conversation steps inside a **Run**; the first event slice will include both `run.*` and `turn.*` lifecycle events, and defer request lifecycle events until Gravity defines a first-class Runtime Request model.
