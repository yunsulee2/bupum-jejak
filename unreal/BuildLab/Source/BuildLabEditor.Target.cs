using UnrealBuildTool;
using System.Collections.Generic;

public class BuildLabEditorTarget : TargetRules
{
    public BuildLabEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        ExtraModuleNames.Add("BuildLab");
    }
}
