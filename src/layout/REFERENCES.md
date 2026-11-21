# layout/ — where the ideas come from

| what | used in | source |
|---|---|---|
| Scaling a box to sit wholly inside another, keeping its shape: the smaller of the two side ratios ("contain") | `frame.js` (`frameZoom`) | W3C, *CSS Images Module Level 3*, `object-fit: contain` |
| Breaking a paragraph by putting as many words on each line as fit, then going on (first fit) | `wrap.js` (`wrapWords`) | the method described, as the one it improves on, in D. E. Knuth, M. F. Plass, "Breaking Paragraphs into Lines", *Software: Practice and Experience* 11 (11), 1981 |
| Finding where a rising count changes by halving an interval again and again (bisection) | `wrap.js` (`narrowestWidth`) | the bisection method, as in R. L. Burden, J. D. Faires, *Numerical Analysis*, Brooks/Cole (the chapter on solutions of equations in one variable) |

**Ours:** a share of the contained size held between two bounds, a point counted as a pixel; balancing by the
narrowest width that keeps the line count; the 12 halvings.
