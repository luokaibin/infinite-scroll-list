export interface DefineCustomElementOptions {
  /** 同名元素已存在（跳过注册）时的回调，可用于输出多版本并存告警 */
  onDuplicate?: () => void;
}

export declare function defineCustomElement(
  tagName: string,
  ctor: CustomElementConstructor,
  options?: DefineCustomElementOptions
): void;
