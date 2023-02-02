class LazyYaAdsStatic {
	debugMode = false; // Выводим ошибки в консоль

	allOnPageCount = 0; // Запоминаем кол-во статичных реклам на странице, чтобы передать в отрисовщик динамических 
	readyCount = 0; // Счетчик "открытых" реклам 

	constructor(debug_mode = false) {
		this.debugMode = debug_mode;
	}

	// Метод запуска, передаем объект с параметрами
	static init(debug_mode = false) {
		try {
			return (new this(debug_mode)).insertScripts().countStaticAds().startListeningScroll();
		} catch (e) {
			if (debug_mode) {
				console.log('StaticYaAds Error: init()')
				console.error(e);
			}
		}
	}

	// Если скрипт яндекс рекламы не подключен - подключаем его (Сделано для безопасности)
	insertScripts() {
		try {
			let hasOnPage = false;
			document.querySelectorAll('script').forEach(element => {
				if (element.src == 'https://yandex.ru/ads/system/context.js') {
					hasOnPage = true
				}
			});
			if (hasOnPage) {
				return this
			}

			// Если нету - добавляем
			let script1 = document.createElement('script')
			script1.innerHTML = 'window.yaContextCb = window.yaContextCb || []'
			let script2 = document.createElement('script')
			script2.setAttribute('src', 'https://yandex.ru/ads/system/context.js')
			script2.setAttribute('async', '')
			document.body.append(script1)
			document.body.append(script2)
			return this
		} catch (e) {
			if (this.debugMode) {
				console.log('StaticYaAds Error: insertScripts()')
				console.error(e);
			}
		}
	}

	// Считаем все статические рекламы 
	countStaticAds() {
		try {
			document.querySelectorAll('.ya_rtb_static').forEach((item, key) => {
				// Передаем уничкальный номер в data атрибут
				item.setAttribute('data-ad-order', key + 1)
			});
			this.readyCount = document.querySelectorAll('.ya_rtb_static').length
			this.allOnPageCount = document.querySelectorAll('.ya_rtb_static').length

			return this
		} catch (e) {
			if (this.debugMode) {
				console.log('StaticYaAds Error: countStaticAds()')
				console.error(e);
			}
		}

	}

	// Пуш всех статических реклам (По дефолту пушим по скроллу, этот метод пушит принудительно ВСЕ статики на странице)
	initStaticAds() {
		try {
			let ads = document.querySelectorAll('.ya_rtb_static')
			ads.forEach(item => {
				if (!item.getAttribute('data-opened')) {
					window.yaContextCb.push(() => {
						Ya.Context.AdvManager.render({
							renderTo: item.id,
							blockId: `${item.getAttribute('data-id')}`,
							pageNumber: this.readyCount,
							async: true
						})
						this.readyCount++;
					})
					item.setAttribute('data-opened', true)
				}
			});
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('StaticYaAds Error: initStaticAds()')
				console.error(e);
			}
		}
	}

	// Если долистали до блока - Запускаем в нем рекламу
	startListeningScroll() {
		try {
			let ads = document.querySelectorAll('.ya_rtb_static')
			let callback = (entries, observer) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						let item = entry.target
						if (!item.getAttribute('data-opened')) {
							window.yaContextCb.push(() => {
								Ya.Context.AdvManager.render({
									renderTo: item.id,
									blockId: `${item.getAttribute('data-id')}`,
									pageNumber: this.readyCount,
									async: true
								})
								this.readyCount++;
							})
							item.setAttribute('data-opened', true)
						}
					}
				})
			}
			let options = {
				rootMargin: '0px 0px 75px 0px',
				threshold: 0,
			}
			let observer = new IntersectionObserver(callback, options)

			// Пуш реклам с заданным типом
			ads.forEach((ad) => {
				if (ad.getAttribute('data-type')) {
					window.yaContextCb.push(() => {
						Ya.Context.AdvManager.render({
							type: ad.getAttribute('data-type'),
							blockId: `${ad.getAttribute('data-id')}`
						})
						this.readyCount++;
					})
				}
				observer.observe(ad)
			})
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('StaticYaAds Error: startListeningScroll()')
				console.error(e);
			}
		}
	}
}

class LazyYaAdsDynamic extends LazyYaAdsStatic {
	// Наследовано от родителя:
	// debugMode | Выводим ошибки в консоль
	// allOnPageCount | Счетчик (сюда приходит кол-во статических реклам (allOnPageCount))

	#block_id; // id рекламы (прим. yandex_rtb_R-A-1966033)
	#renderCode; // id рекламы (прим. R-A-1966033)
	#adIdent; // Храним ключ, который определяется в зависимости от устройства (Desktop/Tablet/Mobile)
	#showEvery; // Показывать какждый n параграф
	#showBetween;

	constructor(debug_mode = false, id, renderCode, show_every = 5, showBetween, desktop_id = 0, mobile_id = 1, all_id = null) {
		super();
		this.debugMode = debug_mode;
		this.#block_id = id;
		this.#renderCode = renderCode;
		this.#showEvery = show_every;
		this.#showBetween = showBetween;
		this.#adIdent = this.#getAdByResponsive(desktop_id, mobile_id, all_id);
		this.allOnPageCount = this.#getAdsCount() + 1;
	}

	static init(params, debug_mode = false) {
		try {
			// Если не указан один из обязательных параметров (*) - прекращаем выполнение
			if ((this.validParams(params)).status) {
				// block_id - id рекламы (прим. yandex_rtb_R-A-1966033) | *
				// renderCode - id рекламы (прим. R-A-1966033) | *
				// showEvery - Показывать какждый n параграф 
				// desktop - id рекламы для ПК | *
				// tablet - id рекламы для планшетов | *
				// all_id - id рекламы для ВСЕХ устройств (Если указано - desktop и tablet не учитываются) 
				// staticCount - Считаем кол-во реклам, чтобы синхронизировать новые со старыми
				// findObject - querySelector для блоков, между которыми будет распологаться реклама
				return (new LazyYaAdsDynamic(debug_mode, params.block_id, params.renderCode, params.showEvery, params.findObject, params.desktop, params.mobile, params.all_id)).insertScripts().drawPlaceholders().startListeningScroll()
			} else {
				if (debug_mode) {
					console.error('Не все обязательные параметры переданы!')
					return console.log((this.validParams(params)).value)
				}
			}
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: init()')
				console.error(e);
			}
		}
	}

	static validParams(params) {
		// Указываем ключи обязательных полей. '/' = ИЛИ
		let requiredFields = ['block_id', 'renderCode', 'desktop/tablet/all_id'];

		requiredFields.forEach((requiredItem, key) => {
			if (requiredItem.indexOf('/') >= 0) {
				requiredItem.split('/').forEach(listItem => {
					if (requiredFields[key] != true) {
						if (params[listItem]) {
							requiredFields[key] = true;
						} else {
							requiredFields[key] = false;
						}
					}
				})
			} else {
				if (params[requiredItem]) {
					requiredFields[key] = true;
				} else {
					requiredFields[key] = false;
				}
			}
		});

		if (requiredFields.indexOf(false) >= 0) {
			return { status: false, value: requiredFields };
		} else {
			return { status: true, value: requiredFields };
		}
	}

	// Считаем кол-во реклам, чтобы синхронизировать новые со старыми
	#getAdsCount() {		
		return document.querySelectorAll('.ya_rtb_static, .ya_rtb_dynamic').length;
	}

	// Подставляем рекламу в зависимости от разрешения
	#getAdByResponsive(big, small, all = null) {
		try {
			if (all) {
				return all;
			}
			if (document.documentElement.clientWidth > 767) {
				return big;
			} else {
				return small;
			}
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: getAdByResponsive()')
				console.error(e);
			}
		}
	}

	// Отрисовываем заглушки
	// redraw = true = дорисовывает новые блоки, если находит новые места по условиям
	drawPlaceholders(redraw = false) {
		try {
			let counter = this.allOnPageCount;
			let itemsList = document.querySelectorAll(this.#showBetween);

			if (itemsList.length <= 0) {
				if (this.debugMode) {
					return console.log('DynamicYaAds Error: drawPlaceholders: с таким тэгом ничего не найдено')
				} else {
					return undefined;
				}
			}

			itemsList.forEach((item, key) => {
				if (key % this.#showEvery == 0 && key != 0) {
					let commercial_template = `<div class="ya_rtb_dynamic ${this.#block_id}" data-id="${counter}" id="${this.#block_id}-${this.#adIdent}-${counter}"></div>`;

					if (redraw) {
						if (!item.classList.contains('ya_rtb_parent')) {
							commercial_template = `<div class="ya_rtb_dynamic ${this.#block_id}" data-id="${counter}" id="${this.#block_id}-${this.#adIdent}-${counter}" data-opened='false'></div>`;
						}
					}
					counter++;
					item.classList.add('ya_rtb_parent')
					item.insertAdjacentHTML('beforebegin', commercial_template);
				}
			});
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: drawPlaceholders()')
				console.error(e);
			}
		}
	}

	// Запускаем рекламу в заглушках
	#pushToPlaceholder() {
		try {
			window.yaContextCb.push(() => {
				Ya.Context.AdvManager.render({
					renderTo: `${this.#block_id}-${this.#adIdent}-${this.allOnPageCount}`,
					blockId: `${this.#renderCode}-${this.#adIdent}`,
					pageNumber: this.allOnPageCount,
					async: true
				})
				this.allOnPageCount++
			})
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: pushToPlaceholder()')
				console.error(e);
			}
		}
	}

	// Запускаем рекламу в заглушках
	pushAllDynamicAds() {
		try {
			let ads = document.querySelectorAll('.' + this.#block_id + '[data-opened=false]')
			ads.forEach(item => {
				window.yaContextCb.push(() => {
					Ya.Context.AdvManager.render({
						renderTo: `${this.#block_id}-${this.#adIdent}-${item.getAttribute('data-id')}`,
						blockId: `${this.#renderCode}-${this.#adIdent}`,
						pageNumber: this.allOnPageCount,
						async: true
					})
					this.allOnPageCount++
				})
				item.setAttribute('data-opened', true)
			});
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: pushAllDynamicAds()')
				console.error(e);
			}
		}
	}

	// Если долистали до заглушки - Запускаем в ней рекламу
	startListeningScroll() {
		try {
			let ads = document.querySelectorAll('.' + this.#block_id)
			let callback = (entries, observer) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						let item = entry.target
						if (!item.getAttribute('data-opened')) {
							item.setAttribute('data-opened', true)
							this.#pushToPlaceholder()
						}
					}
				})
			}
			let options = {
				rootMargin: '0px 0px 75px 0px',
				threshold: 0,
			}
			let observer = new IntersectionObserver(callback, options)
			ads.forEach((ad) => observer.observe(ad))
			return this;
		} catch (e) {
			if (this.debugMode) {
				console.log('DynamicYaAds Error: startListeningScroll()')
				console.error(e);
			}
		}
	}

	// Забрать параметры
	getData() {
		return {
			block_id: this.#block_id,
			renderCode: this.#renderCode,
			adIdent: this.#adIdent,
			showEvery: this.#showEvery,
			showBetween: this.#showBetween,
			allOnPageCount: this.allOnPageCount
		}
	}
}

class AdsConfig {
	// Внутри поста (между параграфами)
	single = {
		desktop: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 9,
			showEvery: 5,
			findObject: '.wrap_page_text p:not(.title_example, .mbf-promo p)',
		},
		tablet: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 10,
			showEvery: 5,
			findObject: '.wrap_page_text p:not(.title_example, .mbf-promo p)',
		},
		mobile: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 11,
			showEvery: 6,
			findObject: '.wrap_page_text p:not(.title_example, .mbf-promo p)',
		},
	}

	// Между постами в категориях
	category = {
		desktop: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 10,
			showEvery: 3,
			findObject: '.wrap_post'
		},
		tablet: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 10,
			showEvery: 3,
			findObject: '.wrap_post'
		},
		mobile: {
			block_id: 'yandex_rtb_R-A-1579880',
			renderCode: 'R-A-1579880',
			all_id: 12,
			showEvery: 3,
			findObject: '.wrap_post'
		},
	}

	// Считаем через какой девайс зашел юзер
	#getDevice() {
		let device = 'desktop';
		if (window.matchMedia('(min-width: 1220px)').matches) {
			device = 'desktop'
		} else if (window.matchMedia('(max-width: 1219px)').matches && window.matchMedia('(min-width: 596px)').matches) {
			device = 'tablet'
		} else if (window.matchMedia('(max-width: 595px)').matches) {
			device = 'mobile'
		}
		return device;
	}

	// Выдаем готовый конфиг (готов для инита динамики LazyYaAdsDynamic.init(config))
	getConfig(pageName) {
		return this[pageName][this.#getDevice()];
	}
}

var YaAdsStatic = undefined;

document.addEventListener('DOMContentLoaded', (e) => {
	YaAdsStatic = LazyYaAdsStatic.init() // Включаем все статик рекламы (Которые отрисовываются через PHP)
})