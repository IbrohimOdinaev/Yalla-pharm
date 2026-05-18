# Changelog

## [0.2.0](https://github.com/IbrohimOdinaev/Yalla-pharm/compare/backend-v0.1.0...backend-v0.2.0) (2026-05-18)


### Features

* **api:** manual lookup controller + close-on-submit hook ([7f68663](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/7f686638c0338ec1f1efe1a91ab63fbe360e19c7))
* **audit:** add audit log and complete payment intent persistence ([5fdd42a](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5fdd42acf15971b6feccbc142a3ecf84bf570954))
* **catalog:** batch medicines/by-ids endpoint + sharper images ([0c3b0f9](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/0c3b0f9eaf03cc83a059754eaf66ef5da041eede))
* **compliance:** privacy policy acceptance gate for prescription submission ([5efd990](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5efd990d82bae1fc6d7f762407d494600596e4be))
* **pharmacist:** 3-tab workspace + active prescription context + bug fixes ([1107189](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/11071899d547b4a828831eec62930a7716791d96))
* **pharmacist:** category subpages + SignalR prescription updates ([b02c489](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/b02c489d6e5c85c3d001bd72f6dfe540964d9d66))
* **pharmacist:** manual-lookup request panel + decode payload binding ([73fb6f4](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/73fb6f4935b0640772ad2ca807288b635c4c7028))
* **prescription:** add decode-failure flow with reasons and refund handling ([0887d39](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/0887d39809e92ea160feac19aa32c760d651e885))
* **prescription:** Add domain + EF + MinIO storage foundation ([aca69a5](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/aca69a54cba7be617c25ebfe896752e78e78ecb5))
* **prescription:** add manual lookup domain + EF schema ([a3bd513](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a3bd513dbd6292f11146d67531d44c6811ce851d))
* **prescription:** auto-cancel unpaid prescriptions after 24 hours ([9f519a1](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/9f519a1e04e153de803de11d956a49ae5991b492))
* **prescription:** Client checklist as cart-style + Оформить/В корзину ([a04ce50](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a04ce508d16e9da0e1cab8aaa71a881f23b6ea2c))
* **prescription:** contacts field + drop tier choice + guest-flow draft ([3d02bac](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/3d02bac7e1af3e9954e22fd35972145e3defe7a1))
* **prescription:** DC payment URL on submit + AuthedImage for protected scans ([73f582e](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/73f582edf7d7c753ceee32fe91f28d2822f15f0e))
* **prescription:** manual lookup application service + storage + DI ([b8cd9c8](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/b8cd9c8cd5227b9373fc67d6b45cc9f9f8f4f83f))
* **prescription:** manual lookup items render as orderable when offers exist ([90881c9](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/90881c978f971ed9fcb507aa2e8e56e2dc3bbf35))
* **prescription:** MVP upload flow + "Мои рецепты" ([618c40d](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/618c40d99e001be479e266a54c4e514c7068e536))
* **prescription:** pair-from-cart analog flow + client toggle ([31620a2](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/31620a20f4631b3f2035c63fe181e6545e8570f7))
* **prescription:** pharmacy options + shadow medicines materialisation ([e547898](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/e547898346f41b7728e3ee9be40e74fde2ac9ab4))
* **prescription:** SuperAdmin confirm + Pharmacist registration + Pharmacist workspace ([abab513](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/abab513cbe8c3a08c599faf7c8b0e9e32f7a9c1f))
* **prescription:** tier preference, analog item kind, cart isolation, auto-cancel + resubmit ([3a66ccf](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/3a66ccf44cca2b3e9d0c189d97071387067c4081))
* **staff:** refine admin and pharmacist workspaces ([a1b98cb](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/a1b98cbc540ee2ec6531f31b6f8c98fa28a8468b))
* **ui:** optimistic cart, marker pulse, single-form admin login, button polish ([1f2c563](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/1f2c563ea64b79c727cde36bcc30613deefbb6bb))
* **users:** add deactivation flow for pharmacy workers and pharmacists ([738d8d5](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/738d8d5793ef2a49a9aa5eadc2a04d6a97a0544a))


### Bug Fixes

* **catalog:** allow inactive medicines on direct id lookup; add pharmacist history ([5db9781](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5db9781a45233469a332750bca00b973d1f363d3))
* **migrations:** make AddUserTelegramId idempotent for prod replay ([7705c9f](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/7705c9fbb2028f918d606dbda749bcdb99e2a300))
* **migrations:** register AddUserTelegramId + AddPharmacyBannerUrl ([6d5ab00](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/6d5ab00c23d270cfb9f92f0fd47dd8a0c3170c13))
* **migrations:** sync model snapshot with PrescriptionTier/Kind/AnalogMedicineId ([3074db5](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/3074db55f0d9078f7352f2223753d73e5d3a0380))
* **migrations:** wire AddUserTelegramId/AddPharmacyBannerUrl to context ([5a21549](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/5a21549ece3b667b68b75a2eb1d2174f83f120d6))
* **prescription:** drop ChecklistItemId from ManualItemLookupRequest ([df3d59e](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/df3d59e2beeeb10955686a4638132ec0dd135c08))
* **prescription:** Multipart upload + auth-hydration race + home CTA ([6e3fae4](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/6e3fae4c0d49b4861c81e48c02a60afc27de5dca))
* **sms:** cap catch-up enqueue to 48h to prevent backlog spam ([e2cc80a](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/e2cc80aaedccdd9c8944ac79502ce5176305f91a))
* **startup:** default migrations on, refuse to start on partial schema ([c37e921](https://github.com/IbrohimOdinaev/Yalla-pharm/commit/c37e921b7d0dab6fd82258d0165f745a1427bc36))
