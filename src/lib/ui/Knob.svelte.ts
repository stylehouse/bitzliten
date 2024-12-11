
// this is almost how we need to think of layout data in letz
// everything's a vector that can be scanned at various detailidity
class Scalapanse {

    min = $state()
    max = $state()
    range = $state()
    // io
    value
    // < time-conditioned output. value at 5fps, _fast at 24|60, _stable 0.2
    //    the 0.2fps layout job... every 5 seconds, or when gestured to move on...
    value_stable
    value_fast
    // and more analytic given value over time, 
    // < for some time, RMS difference in eg 5s
    wobble
    // < likelihood of changing
    jitter
}