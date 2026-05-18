# Changelog

## [0.2.0](https://github.com/IbrohimOdinaev/Yalla-pharm/compare/frontend-v0.1.0...frontend-v0.2.0) (2026-05-18)


### Features

* **admin:** show both short + full IDs across orders, refunds, prescriptions ([8d374a7](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/8d374a70ad63c1ec406e4f8d444f131e644280f1))
* **cart:** responsive two-column layout with sticky checkout receipt ([c4dc38c](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/c4dc38c5d5148b522888efd2fb5707180e261268))
* **catalog:** batch medicines/by-ids endpoint + sharper images ([0c3b0f9](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/0c3b0f9eaf03cc83a059754eaf66ef5da041eede))
* **compliance:** privacy policy acceptance gate for prescription submission ([5efd990](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5efd990d82bae1fc6d7f762407d494600596e4be))
* **header:** morphing cart pill + roomier search + tighter address ([12e7f1d](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/12e7f1d02e8144c94330611919cb66a23de7ccd2))
* **pharmacist:** 3-tab workspace + active prescription context + bug fixes ([1107189](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/11071899d547b4a828831eec62930a7716791d96))
* **pharmacist:** category subpages + SignalR prescription updates ([b02c489](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/b02c489d6e5c85c3d001bd72f6dfe540964d9d66))
* **pharmacist:** home-style catalog + cart row redesign + manual modal ([438754d](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/438754df27aca6bcbed7012f08edb0ba32fc83ca))
* **pharmacist:** manual-lookup request panel + decode payload binding ([73fb6f4](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/73fb6f4935b0640772ad2ca807288b635c4c7028))
* **prescription:** add decode-failure flow with reasons and refund handling ([0887d39](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/0887d39809e92ea160feac19aa32c760d651e885))
* **prescription:** auto-cancel unpaid prescriptions after 24 hours ([9f519a1](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/9f519a1e04e153de803de11d956a49ae5991b492))
* **prescription:** Client checklist as cart-style + Оформить/В корзину ([a04ce50](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a04ce508d16e9da0e1cab8aaa71a881f23b6ea2c))
* **prescription:** client pharmacy picker + checkout source binding ([a718033](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a718033e713339e8edca3c4abbcc44edd6353199))
* **prescription:** contacts field + drop tier choice + guest-flow draft ([3d02bac](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/3d02bac7e1af3e9954e22fd35972145e3defe7a1))
* **prescription:** DC payment URL on submit + AuthedImage for protected scans ([73f582e](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/73f582edf7d7c753ceee32fe91f28d2822f15f0e))
* **prescription:** manual lookup items render as orderable when offers exist ([90881c9](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/90881c978f971ed9fcb507aa2e8e56e2dc3bbf35))
* **prescription:** MVP upload flow + "Мои рецепты" ([618c40d](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/618c40d99e001be479e266a54c4e514c7068e536))
* **prescription:** pair-from-cart analog flow + client toggle ([31620a2](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/31620a20f4631b3f2035c63fe181e6545e8570f7))
* **prescription:** SuperAdmin confirm + Pharmacist registration + Pharmacist workspace ([abab513](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/abab513cbe8c3a08c599faf7c8b0e9e32f7a9c1f))
* **staff:** refine admin and pharmacist workspaces ([a1b98cb](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a1b98cbc540ee2ec6531f31b6f8c98fa28a8468b))
* **ui:** iOS safe-area + dynamic viewport across shells and modals ([1e55281](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1e5528166a537a5e8b05a8a462b82843b7e74779))
* **ui:** optimistic cart, marker pulse, single-form admin login, button polish ([1f2c563](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1f2c563ea64b79c727cde36bcc30613deefbb6bb))
* **ui:** prescriptions list sections + brand socials + image abort ([295db39](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/295db3946f7d5af76a137fbed5040600e6fba9d7))
* **ui:** Yalla Pharm rebrand, header redesign, prescription/cart UX overhaul ([76877dc](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/76877dc9fc727f80b8c66893bc74f3ee51743017))
* **workspace:** admin manual-lookup tab with active + history ([cc3de36](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/cc3de3696e924d4c7798458efbd6b27b83b4a640))
* **workspace:** wire admin manual-lookups tab into bottom nav + sidebar ([648a49b](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/648a49b3a8a058810faaafd85df2f40aad8f76ed))


### Bug Fixes

* **cart-pharmacy:** reliable map-marker → card reveal on mobile ([c79b571](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/c79b571df88bd9e8b8d921e1b7c0e48dfba11698))
* **cart-pharmacy:** resolve shadow medicine titles in option rows ([c31b0ff](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/c31b0ffd575f71882c28cce69680fd5f51ae617a))
* **cart-pharmacy:** use prescription pharmacy-options endpoint in Rx mode ([1299744](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1299744556a265583cf490497d6e0c7bc9d73561))
* **catalog,home,product:** stop random page navs, retry popular rail, two-column product page ([cb9aded](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/cb9aded6b43c2b081eb18797ad68ca3493feb22e))
* **catalog:** allow inactive medicines on direct id lookup; add pharmacist history ([5db9781](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5db9781a45233469a332750bca00b973d1f363d3))
* **env:** accept INTERNAL_API_URL or NEXT_PUBLIC_API_BASE_URL ([b362eab](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/b362eab8913a8d30618a02cb3368496bb380de66))
* **header:** centre bag icon in empty cart pill ([c1d1b97](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/c1d1b9711720f62be08c3fd4213e9d85a36b1fc2))
* **prescription:** drop ChecklistItemId from ManualItemLookupRequest ([df3d59e](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/df3d59e2beeeb10955686a4638132ec0dd135c08))
* **prescription:** drop client pharmacy picker, surface pharmacist text ([1d8db33](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1d8db33a90520526de383da6f349e628d8d98231))
* **prescription:** Multipart upload + auth-hydration race + home CTA ([6e3fae4](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/6e3fae4c0d49b4861c81e48c02a60afc27de5dca))
* **superadmin:** refund form treats inputs as new-only, caps at remaining ([f5f5fca](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/f5f5fca42eca4caa4ba93f9fb72b6916bec19ae0))
* **ui:** category tile arrow variant + drop scale-on-hover ([9d2439e](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/9d2439e365576cc379e516dbdeb1309f52505727))
* **ux:** cross-browser polish + iOS Safari modal stability ([9dbc5c0](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/9dbc5c058e39b4449084b2a48d78f681cf0311f2))
* **workspace,superadmin:** wait for auth hydration before bouncing to / ([781814c](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/781814c449da7b68930e7ed9b0775a858dd537c1))


### Performance Improvements

* **map:** preconnect + eager-preload Yandex SDK ([1c00519](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1c0051987e2be3b97e7b7df9f5ab116467e70c2b))
