import { ArrowRight, Check, CircleHelp } from 'lucide-react';
import type { ProductRoute } from '../core/product';

interface ProductPageContentProps {
  route: ProductRoute;
}

export function ProductPageContent({ route }: ProductPageContentProps) {
  if (route.workflow.length === 0) return null;
  return (
    <section className="route-content" aria-labelledby="route-content-title">
      <div className="route-content__intro">
        <p className="eyebrow">BUILT FOR THE ACTUAL FILE</p>
        <h2 id="route-content-title">From first look to a usable working copy.</h2>
        <p>The workbench separates what was read from the source, what was inferred for display, and what will be changed in an export.</p>
      </div>
      <ol className="route-workflow">
        {route.workflow.map((step, index) => (
          <li key={step.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{step.title}</h3><p>{step.detail}</p></div>
            <ArrowRight aria-hidden="true" />
          </li>
        ))}
      </ol>
      <div className="route-principles" aria-label="Product principles">
        <span><Check /> Original file remains unchanged</span>
        <span><Check /> Local package paths stay local</span>
        <span><Check /> Assumptions are visible</span>
      </div>
      <div className="route-faqs">
        <header><CircleHelp /><h2>Questions this page should answer</h2></header>
        {route.faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
