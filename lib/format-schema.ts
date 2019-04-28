export class FormatNode {
  constructor(
    private _key: string,
    private _type: number,
    private _parent: FormatNode | null,
    private _children: FormatNode[],
  ) {}

  public get key(): string {
    return this._key;
  }

  public get type(): number {
    return this._type;
  }

  public get parent(): FormatNode | null {
    return this._parent;
  }

  public get children(): FormatNode[] {
    return this._children;
  }
}

export class FormatSchema {
  // private _schemas: FormatNode[] = [];
  // private parseNode(node: object): FormatNode | null {
  //   if (!node) {
  //     return null;
  //   }
  //   switch (typeof node) {
  //     case 'object':
  //       this.parseObject(node);
  //       return;
  //   }
  // }
  // private parseObject(
  //   node: object,
  //   currentSchema: FormatNode,
  // ): FormatNode | null {
  //   Object.entries(node).forEach(entry => {
  //     const child = this.parseNode(entry[1]);
  //     if (child) {
  //       currentSchema.children.push(child);
  //     }
  //   });
  // }
}
