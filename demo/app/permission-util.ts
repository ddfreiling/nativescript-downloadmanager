import ContextCompat = android.support.v4.content.ContextCompat;

declare module ExtDef {
    export class ContextCompatFull extends ContextCompat {
        static checkSelfPermission(context: android.content.Context, permission: string): number;
    }
}

export class PermissionUtil {
    static HasPermission(context: android.content.Context, permission: string) {
        const result = ExtDef.ContextCompatFull.checkSelfPermission(context, permission);
        return result == 0;
    }
}